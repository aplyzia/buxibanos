import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Search, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useChannelsStore } from "@/stores/channels-store";
import { useTheme } from "@/theme";
import type { ChannelMessage } from "@/types/database";

interface ChannelSearchBarProps {
  onNavigateToMessage: (channelId: string) => void;
}

export default function ChannelSearchBar({
  onNavigateToMessage,
}: ChannelSearchBarProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);

  const searchResults = useChannelsStore((s) => s.searchResults);
  const isSearching = useChannelsStore((s) => s.isSearching);
  const staffNames = useChannelsStore((s) => s.staffNames);
  const channels = useChannelsStore((s) => s.channels);
  const searchChannelMessages = useChannelsStore(
    (s) => s.searchChannelMessages
  );
  const clearSearchResults = useChannelsStore((s) => s.clearSearchResults);

  const debounceRef = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef[0]) clearTimeout(debounceRef[0]);

      if (!text.trim()) {
        clearSearchResults();
        setShowResults(false);
        return;
      }

      setShowResults(true);
      debounceRef[0] = setTimeout(() => {
        searchChannelMessages(text);
      }, 300);
    },
    [searchChannelMessages, clearSearchResults]
  );

  const handleClear = () => {
    setQuery("");
    clearSearchResults();
    setShowResults(false);
  };

  const getChannelName = (channelId: string) => {
    const ch = channels.find((c) => c.id === channelId);
    return ch?.name || "DM";
  };

  const renderResult = ({ item }: { item: ChannelMessage }) => {
    const senderName =
      staffNames[item.sender_id] || item.sender_id.slice(0, 8);
    const channelName = getChannelName(item.channel_id);
    const time = new Date(item.created_at).toLocaleDateString();

    return (
      <Pressable
        onPress={() => {
          handleClear();
          onNavigateToMessage(item.channel_id);
        }}
        className="px-4 py-3 active:opacity-70"
        style={{
          borderBottomWidth: 1,
          borderBottomColor: colors.surfaceBorder,
        }}
      >
        <View className="flex-row items-center justify-between mb-1">
          <Text
            className="text-sm font-semibold"
            style={{ color: colors.textPrimary }}
          >
            {senderName}
          </Text>
          <Text className="text-xs" style={{ color: colors.textMuted }}>
            {channelName} · {time}
          </Text>
        </View>
        <Text
          className="text-sm"
          numberOfLines={2}
          style={{ color: colors.textSecondary }}
        >
          {item.content}
        </Text>
      </Pressable>
    );
  };

  return (
    <View>
      {/* Search input */}
      <View className="mx-4 mb-2 flex-row items-center rounded-xl px-3" style={{
        backgroundColor: colors.inputBg,
        borderWidth: 1,
        borderColor: colors.inputBorder,
      }}>
        <Search size={16} color={colors.textMuted} />
        <TextInput
          className="flex-1 py-2.5 px-2 text-sm"
          placeholder={t("search.searchMessages")}
          placeholderTextColor={colors.placeholderColor}
          value={query}
          onChangeText={handleSearch}
          style={{ color: colors.textPrimary }}
        />
        {query.length > 0 && (
          <Pressable onPress={handleClear} className="p-1">
            <X size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Search results dropdown */}
      {showResults && (
        <View
          className="mx-4 rounded-xl overflow-hidden mb-2"
          style={{
            backgroundColor: colors.cardBg,
            borderWidth: 1,
            borderColor: colors.cardBorder,
            maxHeight: 300,
          }}
        >
          {isSearching ? (
            <View className="py-6 items-center">
              <ActivityIndicator size="small" color={colors.loaderColor} />
              <Text
                className="text-xs mt-2"
                style={{ color: colors.textMuted }}
              >
                {t("search.searching")}
              </Text>
            </View>
          ) : searchResults.length === 0 ? (
            <View className="py-6 items-center">
              <Text className="text-sm" style={{ color: colors.textMuted }}>
                {t("search.noResults")}
              </Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              renderItem={renderResult}
              style={{ maxHeight: 280 }}
            />
          )}
        </View>
      )}
    </View>
  );
}
