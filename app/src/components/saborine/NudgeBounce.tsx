import { type ReactNode, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing } from "react-native";

// 絵の一辺(Saborineの既定サイズ160)の1割以下に収める、控えめな揺れ幅。
const BOUNCE_HEIGHT = 6;
const BOUNCE_DURATION_MS = 900;

interface NudgeBounceProps {
  // 促しのセリフが出ているときだけtrue。渡す側がセリフの種類を見て決める。
  active: boolean;
  children: ReactNode;
}

// サボリーヌを包んで上下にごく小さく揺らすだけの部品。姿の描き方は一切知らない。
// 端末の「視差効果を減らす」設定が入っているときは揺らさない。
export function NudgeBounce({ active, children }: NudgeBounceProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const offset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) {
        setReduceMotion(enabled);
      }
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!active || reduceMotion) {
      offset.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(offset, {
          toValue: -BOUNCE_HEIGHT,
          duration: BOUNCE_DURATION_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(offset, {
          toValue: 0,
          duration: BOUNCE_DURATION_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      offset.setValue(0);
    };
  }, [active, reduceMotion, offset]);

  return <Animated.View style={{ transform: [{ translateY: offset }] }}>{children}</Animated.View>;
}
