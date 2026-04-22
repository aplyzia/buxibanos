/**
 * Component tests for MessageCard.
 *
 * Verifies rendering of sender name, priority dot, action badges,
 * student name badge, and responded state.
 */

import "./setup";
import React from "react";
import { render, screen } from "@testing-library/react-native";
import { MessageCard } from "@/components/messages/message-card";
import type { Message } from "@/types/database";

const BASE_MESSAGE: Message = {
  id: "msg-1",
  organization_id: "org-1",
  thread_id: null,
  sender_name: "王小明",
  sender_type: "parent",
  sender_user_id: "user-1",
  receiver_name: "李老師",
  receiver_type: "teacher",
  primary_student: "王小華",
  additional_students: [],
  message_type: "attendance",
  priority: "high",
  action_required: true,
  summary: "學生請假通知",
  context: null,
  original_content: "小華今天請假",
  media_urls: [],
  confidence: "high",
  reasoning: null,
  staff_responded: false,
  response_at: null,
  processed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("MessageCard", () => {
  it("renders sender name", () => {
    render(<MessageCard message={BASE_MESSAGE} />);
    expect(screen.getByText("王小明")).toBeTruthy();
  });

  it("renders summary text when available", () => {
    render(<MessageCard message={BASE_MESSAGE} />);
    expect(screen.getByText("學生請假通知")).toBeTruthy();
  });

  it("renders original_content when no summary", () => {
    const msg = { ...BASE_MESSAGE, summary: null };
    render(<MessageCard message={msg} />);
    expect(screen.getByText("小華今天請假")).toBeTruthy();
  });

  it("shows action required badge when unresponded + action_required", () => {
    render(<MessageCard message={BASE_MESSAGE} />);
    expect(screen.getByText("messages.actionRequired")).toBeTruthy();
  });

  it("does not show action required badge when responded", () => {
    const msg = { ...BASE_MESSAGE, staff_responded: true, action_required: true };
    render(<MessageCard message={msg} />);
    expect(screen.queryByText("messages.actionRequired")).toBeNull();
  });

  it("shows responded badge when staff_responded is true", () => {
    const msg = { ...BASE_MESSAGE, staff_responded: true };
    render(<MessageCard message={msg} />);
    expect(screen.getByText("messages.responded")).toBeTruthy();
  });

  it("renders student name badge", () => {
    render(<MessageCard message={BASE_MESSAGE} />);
    expect(screen.getByText("王小華")).toBeTruthy();
  });

  it("renders thread count badge when > 1", () => {
    render(<MessageCard message={BASE_MESSAGE} threadCount={5} />);
    expect(screen.getByText("5")).toBeTruthy();
  });

  it("does not render thread count when 1 or undefined", () => {
    render(<MessageCard message={BASE_MESSAGE} threadCount={1} />);
    expect(screen.queryByText("1")).toBeNull();
  });

  it("renders sender initials in avatar", () => {
    render(<MessageCard message={BASE_MESSAGE} />);
    // "王小明" is a single word (no spaces) -> "王"
    expect(screen.getByText("王")).toBeTruthy();
  });
});
