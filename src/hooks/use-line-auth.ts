import { useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase";

const LINE_CHANNEL_ID = process.env.EXPO_PUBLIC_LINE_CHANNEL_ID ?? "";
const REDIRECT_URI = "buxibanos://auth/callback";

export function useLineAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithLine(inviteCode?: string) {
    if (!LINE_CHANNEL_ID) {
      setError("LINE login is not configured.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Build LINE OAuth 2.1 authorization URL
      const state = Math.random().toString(36).slice(2, 18);
      const params = new URLSearchParams({
        response_type: "code",
        client_id: LINE_CHANNEL_ID,
        redirect_uri: REDIRECT_URI,
        state,
        scope: "profile openid email",
      });

      const authUrl = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`;

      // Open LINE Login in a system browser (ASWebAuthenticationSession on iOS,
      // Chrome Custom Tabs on Android). Waits for the redirect back to buxibanos://
      const result = await WebBrowser.openAuthSessionAsync(authUrl, REDIRECT_URI);

      if (result.type === "cancel" || result.type === "dismiss") {
        setIsLoading(false);
        return;
      }

      if (result.type !== "success") {
        setError("LINE sign-in was cancelled.");
        setIsLoading(false);
        return;
      }

      // Extract authorization code from the redirect URL
      const url = new URL(result.url);
      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");

      if (!code) {
        setError("LINE sign-in failed. Please try again.");
        setIsLoading(false);
        return;
      }

      // Basic CSRF check
      if (returnedState !== state) {
        setError("Invalid state parameter. Please try again.");
        setIsLoading(false);
        return;
      }

      // Exchange code via Supabase Edge Function
      const { data, error: fnError } = await supabase.functions.invoke("line-auth", {
        body: {
          code,
          redirect_uri: REDIRECT_URI,
          invite_code: inviteCode ?? undefined,
        },
      });

      if (fnError || data?.error) {
        setError(data?.error ?? "LINE sign-in failed. Please try again.");
        setIsLoading(false);
        return;
      }

      // Set Supabase session — triggers onAuthStateChange → routes to parent tabs
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      // isLoading will be cleared by navigation
    } catch (err) {
      console.error("useLineAuth error:", err);
      setError("LINE sign-in failed. Please try again.");
      setIsLoading(false);
    }
  }

  function clearError() {
    setError(null);
  }

  return { signInWithLine, isLoading, error, clearError };
}
