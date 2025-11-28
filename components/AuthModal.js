import { useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function AuthModal({
  isDark,
  visible,
  phone,
  password,
  onChangePhone,
  onChangePassword,
  onClose,
  onSubmit,
  loading = false,
  errorMessage = null,
  endpoint,
}) {
  const [passwordVisible, setPasswordVisible] = useState(false);

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <Ionicons name="person-outline" size={18} color="#fff" />
              <Text style={styles.headerText}>Login</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          <View
            style={[
              styles.body,
              { backgroundColor: isDark ? "#0f172a" : "#ffffff" },
            ]}
          >
            <View
              style={[
                styles.inputWrapper,
                {
                  borderColor: isDark
                    ? "rgba(148,163,184,0.4)"
                    : "rgba(15,23,42,0.12)",
                },
              ]}
            >
              <Ionicons
                name="call-outline"
                size={18}
                color={isDark ? "#94a3b8" : "#64748b"}
              />
              <TextInput
                style={[
                  styles.input,
                  { color: isDark ? "#f8fafc" : "#0f172a" },
                ]}
                keyboardType="phone-pad"
                placeholder="e.g., +1234567890 or 1234567890"
                placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                value={phone}
                onChangeText={onChangePhone}
              />
            </View>
            <View
              style={[
                styles.inputWrapper,
                {
                  borderColor: isDark
                    ? "rgba(148,163,184,0.4)"
                    : "rgba(15,23,42,0.12)",
                },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={isDark ? "#94a3b8" : "#64748b"}
              />
              <TextInput
                style={[
                  styles.input,
                  { color: isDark ? "#f8fafc" : "#0f172a" },
                ]}
                placeholder="Enter password"
                placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                secureTextEntry={!passwordVisible}
                value={password}
                onChangeText={onChangePassword}
              />
              <TouchableOpacity
                onPress={() => setPasswordVisible((prev) => !prev)}
                accessibilityLabel={
                  passwordVisible ? "Hide password" : "Show password"
                }
              >
                <Ionicons
                  name={passwordVisible ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={isDark ? "#94a3b8" : "#64748b"}
                />
              </TouchableOpacity>
            </View>
            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}
            <TouchableOpacity
              style={[
                styles.submitButton,
                loading && styles.submitButtonDisabled,
              ]}
              onPress={onSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Login</Text>
              )}
            </TouchableOpacity>
            {endpoint ? (
              <Text
                style={[
                  styles.endpointText,
                  { color: isDark ? "#94a3b8" : "#64748b" },
                ]}
              >
                {endpoint}
              </Text>
            ) : null}
            <Text style={styles.footerText}>
              Don't have an account?{" "}
              <Text style={styles.footerLink}>Register</Text>
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 18,
    elevation: 14,
  },
  header: {
    backgroundColor: "#0f766e",
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },
  body: {
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 14,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
  },
  submitButton: {
    backgroundColor: "#0f766e",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  submitButtonDisabled: {
    opacity: 0.8,
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  endpointText: {
    textAlign: "center",
    fontSize: 12,
    marginTop: 6,
  },
  errorText: {
    color: "#f87171",
    fontSize: 13,
    fontWeight: "600",
  },
  footerText: {
    textAlign: "center",
    color: "#64748b",
    fontSize: 13,
  },
  footerLink: {
    color: "#0f766e",
    fontWeight: "700",
  },
});
