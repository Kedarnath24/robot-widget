import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_EYE_TRAVEL = 5.5;   // px the pupil can move inside the eye
const MAX_HEAD_TILT = 12;    // deg max head rotation
const SPRING_CONFIG = { stiffness: 90, damping: 18, mass: 0.8 };
const EYE_BLINK_MS = [2800, 4500]; // random interval range

// ─── Helpers ──────────────────────────────────────────────────────────────────
function clamp(v, min, max) {
    return Math.min(max, Math.max(min, v));
}

function getPupilOffset(
    eyeCenterX,
    eyeCenterY,
    mouseX,
    mouseY,
) {
    const dx = mouseX - eyeCenterX;
    const dy = mouseY - eyeCenterY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const factor = Math.min(1, 80 / dist); // soften when far away
    return {
        x: clamp((dx / dist) * MAX_EYE_TRAVEL * factor, -MAX_EYE_TRAVEL, MAX_EYE_TRAVEL),
        y: clamp((dy / dist) * MAX_EYE_TRAVEL * factor, -MAX_EYE_TRAVEL, MAX_EYE_TRAVEL),
    };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const Eye = React.memo(({ cx, cy, pupilOffset, isBlinking, accentColor }) => {
    // Transform the motion values to include the base cx/cy
    const pupilCx = useTransform(pupilOffset.x, (v) => cx + v);
    const pupilCy = useTransform(pupilOffset.y, (v) => cy + v);
    const highlightCx = useTransform(pupilOffset.x, (v) => cx + v + 1.5);
    const highlightCy = useTransform(pupilOffset.y, (v) => cy + v - 1.5);

    return (
        <g>
            {/* Eye socket glow */}
            <ellipse
                cx={cx} cy={cy}
                rx={11} ry={isBlinking ? 1.5 : 10}
                fill="#0d0d1a"
                stroke={accentColor}
                strokeWidth={1.5}
                style={{
                    filter: `drop-shadow(0 0 6px ${accentColor})`,
                    transition: 'ry 0.06s ease-in-out',
                }}
            />
            {/* Pupil */}
            {!isBlinking && (
                <motion.circle
                    cx={pupilCx}
                    cy={pupilCy}
                    r={4.5}
                    fill={accentColor}
                    style={{ filter: `drop-shadow(0 0 4px ${accentColor})` }}
                />
            )}
            {/* Pupil highlight */}
            {!isBlinking && (
                <motion.circle
                    cx={highlightCx}
                    cy={highlightCy}
                    r={1.4}
                    fill="white"
                    opacity={0.85}
                />
            )}
        </g>
    );
});

// ─── Main Component ───────────────────────────────────────────────────────────

export const RobotMascot = () => {
    const containerRef = useRef(null);
    const svgRef = useRef(null);

    // Raw mouse position (page-level)
    const [mouse, setMouse] = useState({ x: 0, y: 0 });
    const [svgRect, setSvgRect] = useState(null);

    // Pupil offsets
    const leftPupilX = useSpring(0, SPRING_CONFIG);
    const leftPupilY = useSpring(0, SPRING_CONFIG);
    const rightPupilX = useSpring(0, SPRING_CONFIG);
    const rightPupilY = useSpring(0, SPRING_CONFIG);

    const leftPupil = { x: leftPupilX, y: leftPupilY };
    const rightPupil = { x: rightPupilX, y: rightPupilY };

    // Head spring values
    const rawTiltX = useSpring(0, SPRING_CONFIG);
    const rawTiltY = useSpring(0, SPRING_CONFIG);
    const rawTiltZ = useSpring(0, SPRING_CONFIG);

    // Antenna wobble
    const antennaRotate = useSpring(0, { stiffness: 60, damping: 10 });

    // Hover state for character reactions
    const [isHovered, setIsHovered] = useState(false);

    // Blinking
    const [isBlinking, setIsBlinking] = useState(false);

    // Mouth expression (0=neutral, 1=happy smirk when cursor is near)
    const [isHappy, setIsHappy] = useState(false);

    // Breathing idle scale
    const breatheScale = useSpring(1, { stiffness: 12, damping: 6 });

    // ── Track mouse globally ───────────────────────────────────────────────────
    useEffect(() => {
        let frame;

        const onMove = (e) => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                setMouse({ x: e.clientX, y: e.clientY });
            });
        };

        window.addEventListener('mousemove', onMove, { passive: true });

        return () => {
            window.removeEventListener('mousemove', onMove);
            cancelAnimationFrame(frame);
        };
    }, []);

    // ── Cache SVG bounding rect (update on resize/scroll) ─────────────────────
    const updateRect = useCallback(() => {
        if (svgRef.current) setSvgRect(svgRef.current.getBoundingClientRect());
    }, []);

    useEffect(() => {
        updateRect();
        window.addEventListener('resize', updateRect);
        window.addEventListener('scroll', updateRect, { passive: true });
        return () => {
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect);
        };
    }, [updateRect]);

    // ── React to mouse changes ─────────────────────────────────────────────────
    useEffect(() => {
        if (!svgRect) return;

        // SVG viewBox = 0 0 160 240, rendered in svgRect
        const scaleX = 160 / svgRect.width;
        const scaleY = 260 / svgRect.height;

        // Mouse position in SVG coordinate space
        const mx = (mouse.x - svgRect.left) * scaleX;
        const my = (mouse.y - svgRect.top) * scaleY;

        // Eye centers in SVG coords (approx)
        const leftEyeCenter = { x: 58, y: 100 };
        const rightEyeCenter = { x: 102, y: 100 };

        const left = getPupilOffset(leftEyeCenter.x, leftEyeCenter.y, mx, my);
        const right = getPupilOffset(rightEyeCenter.x, rightEyeCenter.y, mx, my);

        leftPupilX.set(left.x);
        leftPupilY.set(left.y);
        rightPupilX.set(right.x);
        rightPupilY.set(right.y);

        // Head tilt — based on how far cursor is from robot center
        const robotCenterX = svgRect.left + svgRect.width / 2;
        const robotCenterY = svgRect.top + svgRect.height / 2;

        const normX = clamp((mouse.x - robotCenterX) / svgRect.width, -1, 1);
        const normY = clamp((mouse.y - robotCenterY) / svgRect.height, -1, 1);

        rawTiltX.set(normY * MAX_HEAD_TILT * 0.6);
        rawTiltY.set(normX * MAX_HEAD_TILT);
        rawTiltZ.set(normX * 4);

        antennaRotate.set(normX * 18);

        // Happy when cursor is within 200px of center
        const dist = Math.sqrt(
            (mouse.x - robotCenterX) ** 2 + (mouse.y - robotCenterY) ** 2
        );
        setIsHappy(dist < 220);

        // Breathing pulse speed based on proximity
        // (Moved to separate effect)
    }, [mouse, svgRect, isHovered, rawTiltX, rawTiltY, rawTiltZ, antennaRotate, breatheScale, leftPupilX, leftPupilY, rightPupilX, rightPupilY]);

    // ── Breathing / Hover reaction ─────────────────────────────────────────────
    useEffect(() => {
        breatheScale.set(isHovered ? 1.04 : 1);
    }, [isHovered, breatheScale]);

    // ── Blink loop ─────────────────────────────────────────────────────────────
    useEffect(() => {
        let blinkTimeout;
        let closeTimeout;

        const blink = () => {
            const delay =
                EYE_BLINK_MS[0] +
                Math.random() * (EYE_BLINK_MS[1] - EYE_BLINK_MS[0]);

            blinkTimeout = setTimeout(() => {
                setIsBlinking(true);

                closeTimeout = setTimeout(() => {
                    setIsBlinking(false);
                    blink();
                }, 110);
            }, delay);
        };

        blink();

        return () => {
            clearTimeout(blinkTimeout);
            clearTimeout(closeTimeout);
        };
    }, []);

    // ── Derived transforms ─────────────────────────────────────────────────────
    const headRotateX = useTransform(rawTiltX, (v) => `${v}deg`);
    const headRotateY = useTransform(rawTiltY, (v) => `${v}deg`);
    const headRotateZ = useTransform(rawTiltZ, (v) => `${v}deg`);
    const displayScale = useTransform(breatheScale, (v) => v * 0.65);

    // const accentColor = '#FFD700'; // matches --primary
    const accentColor = 'hsla(127, 100%, 50%, 0.61)'; // matches --primary
    return (
        <div
            ref={containerRef}
            style={{ position: 'relative', width: '100%', height: '100%' }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <motion.div
                style={{
                    width: '100%',
                    height: '100%',
                    rotateX: headRotateX,
                    rotateY: headRotateY,
                    rotateZ: headRotateZ,
                    scale: displayScale,
                    transformPerspective: 600,
                    willChange: 'transform',
                }}
                transition={{ type: 'spring', ...SPRING_CONFIG }}
            >
                <svg
                    ref={svgRef}
                    viewBox="0 0 160 260"
                    xmlns="http://www.w3.org/2000/svg"
                    style={{ width: '100%', height: '100%', overflow: 'visible', display: 'block' }}
                    aria-label="VARA Robot Mascot"
                >
                    <defs>
                        {/* Body gradient */}
                        <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#1a1a2e" />
                            <stop offset="100%" stopColor="#0f0f1a" />
                        </linearGradient>

                        {/* Head panel gradient */}
                        <linearGradient id="headGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#22223a" />
                            <stop offset="100%" stopColor="#121228" />
                        </linearGradient>

                        {/* Gold glow filter */}
                        <filter id="goldGlow" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="3" result="blur" />
                            <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>

                        {/* Ambient glow – soft */}
                        <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
                            <feGaussianBlur stdDeviation="6" result="blur" />
                            <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>

                        {/* Rivets clip */}
                        <clipPath id="headClip">
                            <rect x="28" y="68" width="104" height="84" rx="18" />
                        </clipPath>
                    </defs>

                    {/* ── Antenna ──────────────────────────────────────────────────── */}
                    <motion.g
                        style={{
                            originX: '80px',
                            originY: '70px',
                            rotate: antennaRotate,
                        }}
                    >
                        {/* Stem */}
                        <line x1="80" y1="68" x2="80" y2="42" stroke="#2a2a4a" strokeWidth={4} strokeLinecap="round" />

                        {/* Orb */}
                        <motion.circle
                            cx={80} cy={36}
                            r={8}
                            fill={accentColor}
                            style={{ filter: `drop-shadow(0 0 8px ${accentColor})` }}
                            animate={{ r: [8, 9.5, 8], opacity: [1, 0.75, 1] }}
                            transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        {/* Orb shine */}
                        <circle cx={77} cy={33} r={2.5} fill="white" opacity={0.55} />
                    </motion.g>

                    {/* ── Neck ─────────────────────────────────────────────────────── */}
                    <rect x="62" y="148" width="36" height="18" rx="6" fill="#1a1a2e" stroke="#2a2a4a" strokeWidth={1.5} />
                    {/* Neck detail lines */}
                    <line x1="70" y1="150" x2="70" y2="164" stroke="#2a2a4a" strokeWidth={1} opacity={0.7} />
                    <line x1="80" y1="150" x2="80" y2="164" stroke="#2a2a4a" strokeWidth={1} opacity={0.7} />
                    <line x1="90" y1="150" x2="90" y2="164" stroke="#2a2a4a" strokeWidth={1} opacity={0.7} />

                    {/* ── Body ─────────────────────────────────────────────────────── */}
                    <rect x="22" y="164" width="116" height="82" rx="20" fill="url(#bodyGrad)" stroke="#2a2a4a" strokeWidth={2} />

                    {/* Body panel lines */}
                    <line x1="80" y1="172" x2="80" y2="238" stroke="#2a2a4a" strokeWidth={1} opacity={0.5} />
                    <line x1="38" y1="195" x2="122" y2="195" stroke="#2a2a4a" strokeWidth={1} opacity={0.4} />
                    <line x1="38" y1="220" x2="122" y2="220" stroke="#2a2a4a" strokeWidth={1} opacity={0.4} />

                    {/* Chest emblem – VARA logo circle */}
                    <motion.circle
                        cx={80} cy={198} r={16}
                        fill="none"
                        stroke={accentColor}
                        strokeWidth={2}
                        style={{ filter: `drop-shadow(0 0 6px ${accentColor})` }}
                        animate={{ opacity: [1, 0.6, 1] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <text
                        x={80} y={202.5}
                        textAnchor="middle"
                        fontSize={8}
                        fontWeight="bold"
                        fontFamily="sans-serif"
                        fill={accentColor}
                        style={{ userSelect: 'none' }}
                    >
                        ZOLLID
                    </text>

                    {/* Body buttons */}
                    {[176, 225].map((y, row) =>
                        [55, 80, 105].map((x, col) => (
                            <motion.circle
                                key={`btn-${row}-${col}`}
                                cx={x} cy={y + 25}
                                r={4}
                                fill={col === 1 ? accentColor : '#2a2a4a'}
                                stroke={col === 1 ? accentColor : '#3a3a5a'}
                                strokeWidth={1}
                                animate={col === 1 ? { opacity: [1, 0.5, 1] } : {}}
                                transition={{ duration: 1.6 + col * 0.3, repeat: Infinity, ease: 'easeInOut' }}
                            />
                        ))
                    )}

                    {/* ── Arms ─────────────────────────────────────────────────────── */}
                    {/* Left arm */}
                    <motion.g
                        animate={{ rotate: isHappy ? [-4, 4, -4] : [-2, 2, -2] }}
                        transition={{ duration: isHappy ? 0.5 : 2.5, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ originX: '22px', originY: '180px' }}
                    >
                        <rect x="2" y="168" width="22" height="52" rx="11" fill="url(#bodyGrad)" stroke="#2a2a4a" strokeWidth={1.5} />
                        {/* Hand */}
                        <circle cx="13" cy="228" r="10" fill="#1a1a2e" stroke="#2a2a4a" strokeWidth={1.5} />
                        {/* Knuckles */}
                        {[-5, 0, 5].map((dx) => (
                            <circle key={dx} cx={13 + dx} cy={225} r={2} fill="#2a2a4a" />
                        ))}
                    </motion.g>

                    {/* Right arm */}
                    <motion.g
                        animate={{ rotate: isHappy ? [4, -4, 4] : [2, -2, 2] }}
                        transition={{ duration: isHappy ? 0.5 : 2.5, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
                        style={{ originX: '138px', originY: '180px' }}
                    >
                        <rect x="136" y="168" width="22" height="52" rx="11" fill="url(#bodyGrad)" stroke="#2a2a4a" strokeWidth={1.5} />
                        {/* Hand */}
                        <circle cx="147" cy="228" r="10" fill="#1a1a2e" stroke="#2a2a4a" strokeWidth={1.5} />
                        {[-5, 0, 5].map((dx) => (
                            <circle key={dx} cx={147 + dx} cy={225} r={2} fill="#2a2a4a" />
                        ))}
                    </motion.g>

                    {/* ── Legs ─────────────────────────────────────────────────────── */}
                    {/* Left leg */}
                    <motion.g
                        animate={{ rotate: isHappy ? [-3, 3, -3] : [-1, 1, -1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ originX: '52px', originY: '244px' }}
                    >
                        <rect x="36" y="244" width="30" height="18" rx="8" fill="url(#bodyGrad)" stroke="#2a2a4a" strokeWidth={1.5} />
                    </motion.g>

                    {/* Right leg */}
                    <motion.g
                        animate={{ rotate: isHappy ? [3, -3, 3] : [1, -1, 1] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                        style={{ originX: '108px', originY: '244px' }}
                    >
                        <rect x="94" y="244" width="30" height="18" rx="8" fill="url(#bodyGrad)" stroke="#2a2a4a" strokeWidth={1.5} />
                    </motion.g>

                    {/* ── Head ─────────────────────────────────────────────────────── */}
                    <rect x="28" y="68" width="104" height="84" rx="18" fill="url(#headGrad)" stroke="#2a2a4a" strokeWidth={2} />

                    {/* Head panel screws */}
                    {[[34, 74], [34, 144], [126, 74], [126, 144]].map(([x, y], i) => (
                        <circle key={i} cx={x} cy={y} r={2.5} fill="#2a2a4a" stroke="#3a3a5a" strokeWidth={1} />
                    ))}

                    {/* Visor band */}
                    <rect x="32" y="84" width="96" height="52" rx="10"
                        fill="black" fillOpacity={0.5}
                        stroke={accentColor} strokeWidth={1}
                        style={{ filter: `drop-shadow(0 0 4px ${accentColor}44)` }}
                    />
                    {/* Visor shine */}
                    <rect x="36" y="87" width="88" height="12" rx="5"
                        fill="white" fillOpacity={0.05}
                    />

                    {/* ── Eyes ─────────────────────────────────────────────────────── */}
                    <Eye
                        cx={58} cy={106}
                        pupilOffset={leftPupil}
                        isBlinking={isBlinking}
                        accentColor={accentColor}
                    />
                    <Eye
                        cx={102} cy={106}
                        pupilOffset={rightPupil}
                        isBlinking={isBlinking}
                        accentColor={accentColor}
                    />

                    {/* ── Mouth ─────────────────────────────────────────────────────── */}
                    <motion.path
                        d={isHappy
                            ? 'M 62 131 Q 80 144 98 131'   // happy arc
                            : 'M 62 134 Q 80 136 98 134'   // subtle neutral
                        }
                        stroke={accentColor}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        fill="none"
                        style={{ filter: `drop-shadow(0 0 4px ${accentColor})` }}
                        transition={{ duration: 0.3 }}
                    />

                    {/* Mouth dots (speaker) */}
                    {isHappy && [68, 80, 92].map((x) => (
                        <motion.circle
                            key={x}
                            cx={x} cy={139}
                            r={1.5}
                            fill={accentColor}
                            animate={{ opacity: [1, 0.3, 1] }}
                            transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut', delay: x * 0.004 }}
                        />
                    ))}

                    {/* ── Ear panels ───────────────────────────────────────────────── */}
                    {/* Left ear */}
                    <rect x="18" y="88" width="12" height="30" rx="6" fill="#1a1a2e" stroke="#2a2a4a" strokeWidth={1.5} />
                    <circle cx={24} cy={103} r={3} fill={accentColor} opacity={0.6}
                        style={{ filter: `drop-shadow(0 0 4px ${accentColor})` }}
                    />

                    {/* Right ear */}
                    <rect x="130" y="88" width="12" height="30" rx="6" fill="#1a1a2e" stroke="#2a2a4a" strokeWidth={1.5} />
                    <circle cx={136} cy={103} r={3} fill={accentColor} opacity={0.6}
                        style={{ filter: `drop-shadow(0 0 4px ${accentColor})` }}
                    />

                    {/* ── Ambient floor glow ───────────────────────────────────────── */}
                    <motion.ellipse
                        cx={80} cy={262}
                        rx={45} ry={6}
                        fill={accentColor}
                        opacity={0.12}
                        animate={{ rx: [45, 50, 45], opacity: [0.12, 0.07, 0.12] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                </svg>
            </motion.div>
        </div>
    );
};
