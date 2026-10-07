import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { Gamepad2, Loader2, Trophy, Zap, Heart, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface RawQuestion {
  id: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation: string;
}
interface Q3 {
  question: string;
  options: string[]; // exactly 3
  correct: number;
  explanation: string;
}
interface QuizGameProps {
  uploadId: string;
  content: string;
}

// ---------- Tunables ----------
const LANE_X = [-2.4, 0, 2.4];
const START_SPEED = 14;
const MAX_SPEED = 30;
const GATE_GAP = 70; // distance between answer gates
const JUMP_V = 9.5;
const GRAVITY = 26;
const SLIDE_TIME = 0.7;
const START_LIVES = 3;
const SEGMENT = 40;
const SEGMENTS = 6;

type Phase = "idle" | "countdown" | "running" | "over";

/** Reduce any question to 3 options, always keeping the correct one. */
function toThree(q: RawQuestion): Q3 {
  const opts = q.options.map((o, i) => ({ o, ok: i === q.correct_answer }));
  const right = opts.find((x) => x.ok)!;
  const wrong = opts.filter((x) => !x.ok).slice(0, 2);
  const all = [right, ...wrong].sort(() => Math.random() - 0.5);
  return {
    question: q.question,
    options: all.map((x) => x.o),
    correct: all.findIndex((x) => x.ok),
    explanation: q.explanation,
  };
}

// ---------- Audio ----------
let actx: AudioContext | null = null;
function beep(freq: number, dur = 0.12, type: OscillatorType = "square", vol = 0.08) {
  try {
    actx ??= new AudioContext();
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + dur);
  } catch {
    /* ignore */
  }
}
const sfx = {
  coin: () => beep(1320, 0.08, "triangle"),
  whoosh: () => beep(220, 0.08, "sawtooth", 0.04),
  correct: () => [523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, 0.18, "triangle"), i * 80)),
  wrong: () => beep(90, 0.4, "sawtooth", 0.12),
};

// ---------- Shared game state (mutable, read in useFrame) ----------
interface Obstacle {
  z: number;
  lane: number;
  kind: "low" | "high" | "train";
  hit?: boolean;
}
interface Coin {
  z: number;
  lane: number;
  taken?: boolean;
}
interface World {
  dist: number;
  speed: number;
  lane: number;
  x: number;
  y: number;
  vy: number;
  slide: number;
  gateZ: number; // distance where current gate sits
  obstacles: Obstacle[];
  coins: Coin[];
  shake: number;
  invuln: number;
  flash: { lane: number; ok: boolean; t: number } | null;
}

function newWorld(): World {
  return {
    dist: 0,
    speed: START_SPEED,
    lane: 1,
    x: 0,
    y: 0,
    vy: 0,
    slide: 0,
    gateZ: GATE_GAP,
    obstacles: [],
    coins: [],
    shake: 0,
    invuln: 0,
    flash: null,
  };
}

/** Fill obstacles/coins between gate start and gate end. */
function populate(w: World, from: number, to: number) {
  for (let z = from + 14; z < to - 16; z += 14 + Math.random() * 6) {
    const lane = Math.floor(Math.random() * 3);
    const r = Math.random();
    const kind: Obstacle["kind"] = r < 0.4 ? "low" : r < 0.7 ? "high" : "train";
    w.obstacles.push({ z, lane, kind });
    const coinLane = (lane + 1 + Math.floor(Math.random() * 2)) % 3;
    for (let i = 0; i < 4; i++) w.coins.push({ z: z - 4 + i * 2, lane: coinLane });
  }
}

// ---------- Textures ----------
function useGroundTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const g = c.getContext("2d")!;
    g.fillStyle = "#6b6259";
    g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2200; i++) {
      const v = 70 + Math.random() * 70;
      g.fillStyle = `rgb(${v},${v - 6},${v - 12})`;
      g.fillRect(Math.random() * 256, Math.random() * 256, 3, 3);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(3, 20);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
}

// ---------- Scene pieces ----------
function TrackSegment({ z }: { z: number }) {
  const ties = useMemo(() => Array.from({ length: 20 }, (_, i) => i * 2), []);
  return (
    <group position={[0, 0, -z]}>
      {LANE_X.map((x) => (
        <group key={x} position={[x, 0, 0]}>
          {ties.map((t) => (
            <mesh key={t} position={[0, 0.06, -t]} receiveShadow>
              <boxGeometry args={[1.9, 0.12, 0.35]} />
              <meshStandardMaterial color="#5a3d26" roughness={0.9} />
            </mesh>
          ))}
          {[-0.6, 0.6].map((rx) => (
            <mesh key={rx} position={[rx, 0.18, -SEGMENT / 2 + 1]}>
              <boxGeometry args={[0.1, 0.14, SEGMENT]} />
              <meshStandardMaterial color="#b8bcc4" metalness={0.8} roughness={0.3} />
            </mesh>
          ))}
        </group>
      ))}
      {/* side walls with graffiti-colored panels */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 5.6, 1.8, -SEGMENT / 2]}>
            <boxGeometry args={[0.6, 3.6, SEGMENT]} />
            <meshStandardMaterial color="#a0522d" roughness={0.95} />
          </mesh>
          {[0, 1, 2].map((i) => (
            <mesh key={i} position={[s * 5.28, 1.6, -6 - i * 13]}>
              <boxGeometry args={[0.05, 1.6, 5]} />
              <meshStandardMaterial color={["#f2b134", "#3fa7d6", "#e5446d"][(i + (s > 0 ? 1 : 0)) % 3]} />
            </mesh>
          ))}
          <mesh position={[s * 4.6, 3.5, -10]}>
            <cylinderGeometry args={[0.08, 0.08, 7]} />
            <meshStandardMaterial color="#444" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Runner({ w }: { w: React.MutableRefObject<World> }) {
  const root = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Mesh>(null);
  const legR = useRef<THREE.Mesh>(null);
  const armL = useRef<THREE.Mesh>(null);
  const armR = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const s = w.current;
    if (!root.current) return;
    root.current.position.set(s.x, s.y, 0);
    const sliding = s.slide > 0;
    root.current.scale.y = sliding ? 0.5 : 1;
    root.current.rotation.z = (LANE_X[s.lane] - s.x) * -0.15;
    root.current.visible = s.invuln <= 0 || Math.floor(s.invuln * 12) % 2 === 0;
    const t = s.dist * 0.6;
    const air = s.y > 0.05;
    const sw = air ? 0.6 : Math.sin(t) * 0.9;
    if (legL.current) legL.current.rotation.x = sw;
    if (legR.current) legR.current.rotation.x = -sw;
    if (armL.current) armL.current.rotation.x = -sw;
    if (armR.current) armR.current.rotation.x = sw;
  });
  return (
    <group ref={root}>
      {/* legs */}
      <mesh ref={legL} position={[-0.18, 0.75, 0]} castShadow>
        <boxGeometry args={[0.24, 0.8, 0.26]} />
        <meshStandardMaterial color="#2b4c7e" />
      </mesh>
      <mesh ref={legR} position={[0.18, 0.75, 0]} castShadow>
        <boxGeometry args={[0.24, 0.8, 0.26]} />
        <meshStandardMaterial color="#2b4c7e" />
      </mesh>
      {/* hoodie */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <boxGeometry args={[0.7, 0.8, 0.4]} />
        <meshStandardMaterial color="#e8892f" />
      </mesh>
      <mesh ref={armL} position={[-0.47, 1.55, 0]} castShadow>
        <boxGeometry args={[0.2, 0.7, 0.22]} />
        <meshStandardMaterial color="#e8892f" />
      </mesh>
      <mesh ref={armR} position={[0.47, 1.55, 0]} castShadow>
        <boxGeometry args={[0.2, 0.7, 0.22]} />
        <meshStandardMaterial color="#e8892f" />
      </mesh>
      {/* head + cap */}
      <mesh position={[0, 2.15, 0]} castShadow>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="#8d5524" />
      </mesh>
      <mesh position={[0, 2.35, -0.05]}>
        <cylinderGeometry args={[0.31, 0.31, 0.15, 16]} />
        <meshStandardMaterial color="#d62839" />
      </mesh>
      <mesh position={[0, 2.3, 0.28]}>
        <boxGeometry args={[0.4, 0.05, 0.3]} />
        <meshStandardMaterial color="#d62839" />
      </mesh>
      {/* backpack */}
      <mesh position={[0, 1.5, 0.3]}>
        <boxGeometry args={[0.5, 0.6, 0.2]} />
        <meshStandardMaterial color="#3a7d44" />
      </mesh>
    </group>
  );
}

function Obstacles({ w }: { w: React.MutableRefObject<World> }) {
  const [, force] = useState(0);
  const grp = useRef<THREE.Group>(null);
  const count = useRef(0);
  useFrame(() => {
    if (w.current.obstacles.length !== count.current) {
      count.current = w.current.obstacles.length;
      force((n) => n + 1);
    }
    if (grp.current) grp.current.position.z = w.current.dist;
  });
  return (
    <group ref={grp}>
      {w.current.obstacles.map((o, i) => (
        <group key={i} position={[LANE_X[o.lane], 0, -o.z]}>
          {o.kind === "low" && (
            <>
              <mesh position={[0, 0.55, 0]} castShadow>
                <boxGeometry args={[1.9, 0.25, 0.2]} />
                <meshStandardMaterial color="#f2f2f2" />
              </mesh>
              <mesh position={[0, 0.3, 0]}>
                <boxGeometry args={[1.9, 0.25, 0.2]} />
                <meshStandardMaterial color="#d62839" />
              </mesh>
              {[-0.85, 0.85].map((x) => (
                <mesh key={x} position={[x, 0.35, 0]}>
                  <boxGeometry args={[0.12, 0.7, 0.12]} />
                  <meshStandardMaterial color="#333" />
                </mesh>
              ))}
            </>
          )}
          {o.kind === "high" && (
            <>
              <mesh position={[0, 1.9, 0]} castShadow>
                <boxGeometry args={[2, 0.8, 0.25]} />
                <meshStandardMaterial color="#f2b134" />
              </mesh>
              {[-0.9, 0.9].map((x) => (
                <mesh key={x} position={[x, 1, 0]}>
                  <boxGeometry args={[0.12, 2.3, 0.12]} />
                  <meshStandardMaterial color="#333" />
                </mesh>
              ))}
            </>
          )}
          {o.kind === "train" && (
            <group position={[0, 0, -4]}>
              <mesh position={[0, 1.6, 0]} castShadow>
                <boxGeometry args={[2, 3, 10]} />
                <meshStandardMaterial color="#2f6690" metalness={0.4} roughness={0.5} />
              </mesh>
              <mesh position={[0, 2.2, 5.01]}>
                <planeGeometry args={[1.5, 1]} />
                <meshStandardMaterial color="#a8dadc" emissive="#a8dadc" emissiveIntensity={0.3} />
              </mesh>
              <mesh position={[0, 0.9, 5.01]}>
                <planeGeometry args={[1.8, 0.3]} />
                <meshStandardMaterial color="#f2b134" />
              </mesh>
            </group>
          )}
        </group>
      ))}
    </group>
  );
}

function CoinsView({ w }: { w: React.MutableRefObject<World> }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const s = w.current;
    let n = 0;
    for (const c of s.coins) {
      const rel = c.z - s.dist;
      if (c.taken || rel < -5 || rel > 120 || n >= 200) continue;
      dummy.position.set(LANE_X[c.lane], 1, -rel);
      dummy.rotation.set(Math.PI / 2, 0, state.clock.elapsedTime * 4);
      dummy.updateMatrix();
      m.setMatrixAt(n++, dummy.matrix);
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, 200]}>
      <cylinderGeometry args={[0.35, 0.35, 0.08, 16]} />
      <meshStandardMaterial color="#ffc93c" metalness={0.9} roughness={0.25} emissive="#7a5a00" />
    </instancedMesh>
  );
}

function Gate({ w, q }: { w: React.MutableRefObject<World>; q: Q3 }) {
  const grp = useRef<THREE.Group>(null);
  const mats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  useFrame(() => {
    const s = w.current;
    if (grp.current) grp.current.position.z = -(s.gateZ - s.dist);
    mats.current.forEach((m, i) => {
      if (!m) return;
      const f = s.flash;
      const c = f && f.t > 0 ? (i === q.correct ? "#2a9d8f" : i === f.lane ? "#d62839" : "#1d3557") : "#1d3557";
      m.color.set(c);
    });
  });
  return (
    <group ref={grp}>
      {/* overhead beam */}
      <mesh position={[0, 4.4, 0]}>
        <boxGeometry args={[9, 0.3, 0.3]} />
        <meshStandardMaterial color="#444" metalness={0.6} />
      </mesh>
      {[-3.6, -1.2, 1.2, 3.6].map((x) => (
        <mesh key={x} position={[x, 2.2, 0]}>
          <boxGeometry args={[0.15, 4.4, 0.15]} />
          <meshStandardMaterial color="#555" />
        </mesh>
      ))}
      {q.options.map((opt, i) => (
        <group key={i} position={[LANE_X[i], 3.3, 0.1]}>
          <mesh>
            <planeGeometry args={[2.2, 1.7]} />
            <meshStandardMaterial ref={(m) => (mats.current[i] = m)} color="#1d3557" />
          </mesh>
          <Text
            position={[0, 0.55, 0.01]}
            fontSize={0.32}
            color="#ffc93c"
            anchorX="center"
            anchorY="middle"
          >
            {"ABC"[i]}
          </Text>
          <Text
            position={[0, -0.15, 0.01]}
            fontSize={0.19}
            maxWidth={2}
            textAlign="center"
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
          >
            {opt.length > 60 ? opt.slice(0, 57) + "…" : opt}
          </Text>
        </group>
      ))}
    </group>
  );
}

function CameraRig({ w }: { w: React.MutableRefObject<World> }) {
  useFrame((state, raw) => {
    const dt = Math.min(raw, 0.05);
    const s = w.current;
    const cam = state.camera as THREE.PerspectiveCamera;
    const tx = s.x * 0.6;
    cam.position.x += (tx - cam.position.x) * (1 - Math.exp(-6 * dt));
    cam.position.y = 4.2 + s.y * 0.4 + (Math.random() - 0.5) * s.shake;
    cam.position.z = 7.5;
    cam.lookAt(cam.position.x * 0.5, 1.5, -10);
    const fov = 62 + (s.speed - START_SPEED) * 0.5;
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

function Track({ w }: { w: React.MutableRefObject<World> }) {
  const grp = useRef<THREE.Group>(null);
  const ground = useGroundTexture();
  useFrame(() => {
    const s = w.current;
    if (grp.current) grp.current.position.z = s.dist % SEGMENT;
    ground.offset.y = s.dist / 12;
  });
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -100]} receiveShadow>
        <planeGeometry args={[11, 240]} />
        <meshStandardMaterial map={ground} roughness={1} />
      </mesh>
      <group ref={grp}>
        {Array.from({ length: SEGMENTS }).map((_, i) => (
          <TrackSegment key={i} z={i * SEGMENT - SEGMENT} />
        ))}
      </group>
    </>
  );
}

/** Core simulation: runs every frame, calls back into React for events. */
function Sim({
  w,
  active,
  q,
  onAnswer,
  onCoin,
  onCrash,
}: {
  w: React.MutableRefObject<World>;
  active: boolean;
  q: Q3 | undefined;
  onAnswer: (choice: number) => void;
  onCoin: () => void;
  onCrash: () => void;
}) {
  useFrame((_, raw) => {
    if (!active || !q) return;
    const dt = Math.min(raw, 0.05);
    const s = w.current;
    s.dist += s.speed * dt;
    s.x += (LANE_X[s.lane] - s.x) * (1 - Math.exp(-14 * dt));
    s.vy -= GRAVITY * dt;
    s.y = Math.max(0, s.y + s.vy * dt);
    if (s.y === 0) s.vy = 0;
    s.slide = Math.max(0, s.slide - dt);
    s.shake = Math.max(0, s.shake - dt * 2);
    s.invuln = Math.max(0, s.invuln - dt);
    if (s.flash) s.flash.t -= dt;

    // coins
    for (const c of s.coins) {
      if (c.taken) continue;
      if (c.lane === s.lane && Math.abs(c.z - s.dist) < 0.8 && s.y < 2) {
        c.taken = true;
        onCoin();
      }
    }
    // obstacles
    for (const o of s.obstacles) {
      if (o.hit || o.lane !== s.lane || s.invuln > 0) continue;
      const len = o.kind === "train" ? 10 : 0.4;
      const front = o.z - (o.kind === "train" ? -1 : 0);
      if (s.dist > front - 0.4 && s.dist < front + len) {
        const dodged = (o.kind === "low" && s.y > 0.8) || (o.kind === "high" && s.slide > 0);
        if (!dodged) {
          o.hit = true;
          s.shake = 0.6;
          s.invuln = 1.5;
          onCrash();
        }
      }
    }
    // answer gate
    if (s.dist >= s.gateZ) {
      const choice = s.lane;
      s.flash = { lane: choice, ok: choice === q.correct, t: 1.2 };
      onAnswer(choice);
    }
    // cleanup old
    if (s.obstacles.length > 60) s.obstacles = s.obstacles.filter((o) => o.z > s.dist - 20);
    if (s.coins.length > 300) s.coins = s.coins.filter((c) => c.z > s.dist - 20);
  });
  return null;
}

// ---------- Main component ----------
export function QuizGame({ uploadId, content }: QuizGameProps) {
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<Q3[]>([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [streak, setStreak] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [phase, setPhase] = useState<Phase>("idle");
  const [countdown, setCountdown] = useState(3);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [answered, setAnswered] = useState(0);
  const world = useRef<World>(newWorld());
  const touch = useRef<{ x: number; y: number } | null>(null);
  const { toast } = useToast();
  const { session } = useAuth();
  const q = questions[index];

  const generateQuiz = async () => {
    if (!session) {
      toast({ title: "Please sign in", description: "Sign in to play the quiz.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const safe = content.length > 50000 ? content.substring(0, 50000) : content;
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: { uploadId, content: safe, count: 10 },
      });
      if (error) throw error;
      if (!data?.questions?.length) throw new Error("No questions were generated.");
      setQuestions((data.questions as RawQuestion[]).map(toThree));
      startGame();
    } catch (e) {
      toast({
        title: "Couldn't make the quiz",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startGame = () => {
    world.current = newWorld();
    populate(world.current, 0, GATE_GAP);
    setIndex(0);
    setScore(0);
    setCoins(0);
    setStreak(0);
    setLives(START_LIVES);
    setCorrectCount(0);
    setAnswered(0);
    setFeedback(null);
    setCountdown(3);
    setPhase("countdown");
  };

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown === 0) {
      setPhase("running");
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // Distance score ticker
  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(() => setScore((s) => s + 1), 100);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (lives <= 0 && phase === "running") setTimeout(() => setPhase("over"), 600);
  }, [lives, phase]);

  const onAnswer = useCallback(
    (choice: number) => {
      const s = world.current;
      const cur = questions[index];
      if (!cur) return;
      const ok = choice === cur.correct;
      setAnswered((a) => a + 1);
      if (ok) {
        sfx.correct();
        setStreak((st) => {
          setScore((sc) => sc + 100 + st * 25);
          return st + 1;
        });
        setCorrectCount((c) => c + 1);
        s.speed = Math.min(s.speed + 1.5, MAX_SPEED);
        setFeedback({ ok: true, text: cur.explanation });
      } else {
        sfx.wrong();
        s.shake = 0.6;
        setStreak(0);
        setLives((l) => l - 1);
        setFeedback({ ok: false, text: `Answer: ${cur.options[cur.correct]}. ${cur.explanation}` });
      }
      const next = index + 1;
      if (next >= questions.length) {
        setTimeout(() => setPhase("over"), 900);
        s.gateZ = Infinity;
        return;
      }
      const from = s.gateZ;
      s.gateZ = from + GATE_GAP;
      populate(s, from, s.gateZ);
      setIndex(next);
    },
    [questions, index]
  );

  const onCoin = useCallback(() => {
    sfx.coin();
    setCoins((c) => c + 1);
    setScore((s) => s + 5);
  }, []);
  const onCrash = useCallback(() => {
    sfx.wrong();
    setStreak(0);
    setLives((l) => l - 1);
  }, []);

  const act = useCallback(
    (a: "left" | "right" | "jump" | "slide") => {
      if (phase !== "running") return;
      const s = world.current;
      if (a === "left" && s.lane > 0) s.lane--, sfx.whoosh();
      if (a === "right" && s.lane < 2) s.lane++, sfx.whoosh();
      if (a === "jump" && s.y === 0) (s.vy = JUMP_V), (s.slide = 0), sfx.whoosh();
      if (a === "slide") {
        s.slide = SLIDE_TIME;
        if (s.y > 0) s.vy = -JUMP_V * 1.5;
        sfx.whoosh();
      }
    },
    [phase]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, "left" | "right" | "jump" | "slide"> = {
        ArrowLeft: "left", a: "left", A: "left",
        ArrowRight: "right", d: "right", D: "right",
        ArrowUp: "jump", w: "jump", W: "jump", " ": "jump",
        ArrowDown: "slide", s: "slide", S: "slide",
      };
      const a = map[e.key];
      if (a && phase === "running") {
        e.preventDefault();
        act(a);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [act, phase]);

  if (phase === "idle" || questions.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="w-20 h-20 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
          <Gamepad2 className="w-10 h-10 text-accent" />
        </div>
        <h3 className="font-display text-xl font-semibold">Subway Quiz Runner</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Run the tracks, grab coins, jump barriers and roll under signs. Answer gates span all 3 tracks —
          be on the track with the right answer when you pass through!
        </p>
        <Button onClick={generateQuiz} disabled={loading} variant="accent" className="mt-4">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Making your questions...
            </>
          ) : (
            <>
              <Gamepad2 className="w-4 h-4" /> Start Running!
            </>
          )}
        </Button>
      </div>
    );
  }

  if (phase === "over") {
    return (
      <div className="text-center py-12 space-y-5">
        <div className="w-24 h-24 mx-auto rounded-full bg-gradient-primary flex items-center justify-center">
          <Trophy className="w-12 h-12 text-primary-foreground" />
        </div>
        <h3 className="font-display text-3xl font-bold">{lives <= 0 ? "Busted!" : "Finish line!"}</h3>
        <div className="text-6xl font-display font-bold text-gradient-primary">{score}</div>
        <p className="text-muted-foreground">
          {correctCount} of {answered} correct • {coins} coins
        </p>
        <div className="flex gap-3 justify-center">
          <Button onClick={startGame} variant="accent">Run again</Button>
          <Button onClick={() => { setQuestions([]); setPhase("idle"); }} variant="outline">
            New questions
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 select-none">
      <div className="bg-card rounded-lg p-3 border border-border">
        <p className="text-xs text-muted-foreground mb-1">Question {index + 1}/{questions.length}</p>
        <h3 className="font-display text-base md:text-lg font-semibold">{q?.question}</h3>
        {q && (
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            {q.options.map((o, i) => (
              <div key={i} className="rounded-md bg-muted px-2 py-1">
                <strong className="text-accent">{"ABC"[i]}</strong> {o}
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className="relative h-[460px] rounded-xl overflow-hidden border border-border touch-none"
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={(e) => {
          if (!touch.current) return;
          const dx = e.changedTouches[0].clientX - touch.current.x;
          const dy = e.changedTouches[0].clientY - touch.current.y;
          if (Math.max(Math.abs(dx), Math.abs(dy)) > 25) {
            if (Math.abs(dx) > Math.abs(dy)) act(dx > 0 ? "right" : "left");
            else act(dy < 0 ? "jump" : "slide");
          }
          touch.current = null;
        }}
      >
        <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 4.2, 7.5], fov: 62 }}>
          <color attach="background" args={["#9fd3f0"]} />
          <fog attach="fog" args={["#9fd3f0", 40, 130]} />
          <hemisphereLight args={["#ffffff", "#8a7a66", 0.9]} />
          <directionalLight position={[6, 12, 6]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
          <Track w={world} />
          <CoinsView w={world} />
          <Obstacles w={world} />
          {q && <Gate w={world} q={q} />}
          <Runner w={world} />
          <CameraRig w={world} />
          <Sim w={world} active={phase === "running"} q={q} onAnswer={onAnswer} onCoin={onCoin} onCrash={onCrash} />
        </Canvas>

        {/* HUD */}
        <div className="absolute inset-x-0 top-0 p-3 flex justify-between items-start pointer-events-none">
          <div className="space-y-1">
            <div className="rounded-lg bg-background/80 px-3 py-1 font-display text-xl font-bold">{score}</div>
            <div className="rounded-lg bg-background/80 px-3 py-1 text-sm font-bold flex items-center gap-1">
              <Coins className="w-4 h-4 text-accent" /> {coins}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-1 rounded-lg bg-background/80 px-2 py-1">
              {Array.from({ length: START_LIVES }).map((_, i) => (
                <Heart key={i} className={cn("w-5 h-5", i < lives ? "text-destructive fill-destructive" : "text-muted-foreground")} />
              ))}
            </div>
            {streak >= 2 && (
              <div className="rounded-lg bg-background/80 px-2 py-1 text-accent text-sm font-bold flex items-center gap-1">
                <Zap className="w-4 h-4" /> x{streak}
              </div>
            )}
          </div>
        </div>

        {feedback && phase === "running" && (
          <div
            key={answered}
            className={cn(
              "absolute inset-x-3 bottom-3 rounded-lg p-2 text-sm pointer-events-none animate-fade-in",
              feedback.ok ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"
            )}
          >
            <strong>{feedback.ok ? "Correct! " : "Wrong gate! "}</strong>
            <span className="line-clamp-2">{feedback.text}</span>
          </div>
        )}

        {phase === "countdown" && (
          <div className="absolute inset-0 flex items-center justify-center bg-foreground/40">
            <span className="font-display text-8xl font-bold text-background">{countdown === 0 ? "GO!" : countdown}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 md:hidden">
        <Button variant="outline" onClick={() => act("left")}>◀</Button>
        <Button variant="outline" onClick={() => act("jump")}>▲</Button>
        <Button variant="outline" onClick={() => act("slide")}>▼</Button>
        <Button variant="outline" onClick={() => act("right")}>▶</Button>
      </div>
      <p className="text-xs text-center text-muted-foreground">
        ← → switch tracks • ↑ / Space jump • ↓ roll • Swipe on phones
      </p>
    </div>
  );
}
