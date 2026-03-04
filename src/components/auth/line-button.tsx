import { Pressable, View, Text, ActivityIndicator } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

interface LineButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  label: string;
}

/** Official LINE brand green: #06C755 */
const LINE_GREEN = "#06C755";

function LineIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 44 44" fill="none">
      {/* LINE logo — rounded rect background */}
      <Rect width={44} height={44} rx={10} fill="white" />
      {/* LINE speech-bubble icon path */}
      <Path
        d="M22 6C13.163 6 6 12.268 6 19.992c0 6.964 6.178 12.8 14.52 13.84.565.122 1.335.373 1.53.857.176.44.115 1.129.056 1.574l-.247 1.488c-.075.44-.347 1.72 1.506.937 1.853-.784 10.001-5.89 13.644-10.086C38.97 25.812 38 23 38 19.992 38 12.268 30.837 6 22 6Z"
        fill={LINE_GREEN}
      />
      <Path
        d="M32.25 23.25h-4.5a.75.75 0 0 1-.75-.75v-6a.75.75 0 0 1 1.5 0v5.25h3.75a.75.75 0 0 1 0 1.5ZM19.5 23.25a.75.75 0 0 1-.75-.75v-6a.75.75 0 0 1 1.5 0v6a.75.75 0 0 1-.75.75ZM25.5 23.25a.75.75 0 0 1-.609-.313l-3-4.5v4.063a.75.75 0 0 1-1.5 0V16.5a.75.75 0 0 1 1.359-.438l3 4.5V16.5a.75.75 0 0 1 1.5 0v6a.75.75 0 0 1-.75.75ZM15.75 23.25h-3a.75.75 0 0 1-.75-.75v-6a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 0 1.5H13.5v1.5h2.25a.75.75 0 0 1 0 1.5H13.5v1.5h2.25a.75.75 0 0 1 0 1.5Z"
        fill="white"
      />
    </Svg>
  );
}

export function LineButton({ onPress, loading = false, disabled = false, label }: LineButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => ({
        borderRadius: 12,
        overflow: "hidden",
        opacity: isDisabled ? 0.6 : pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          backgroundColor: LINE_GREEN,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 14,
          paddingHorizontal: 20,
          gap: 10,
        }}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <LineIcon />
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>
              {label}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}
