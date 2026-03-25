/**
 * Component tests for PriorityFilterBar.
 *
 * Verifies that all filter buttons render and fire onChange correctly.
 */

import "./setup";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { PriorityFilterBar } from "@/components/messages/priority-filter";

describe("PriorityFilterBar", () => {
  it("renders all four filter buttons", () => {
    const onChange = jest.fn();
    render(<PriorityFilterBar active="all" onChange={onChange} />);

    expect(screen.getByText("messages.filterAll")).toBeTruthy();
    expect(screen.getByText("priority.high")).toBeTruthy();
    expect(screen.getByText("priority.medium")).toBeTruthy();
    expect(screen.getByText("priority.low")).toBeTruthy();
  });

  it("calls onChange with 'high' when high filter is pressed", () => {
    const onChange = jest.fn();
    render(<PriorityFilterBar active="all" onChange={onChange} />);

    fireEvent.press(screen.getByText("priority.high"));
    expect(onChange).toHaveBeenCalledWith("high");
  });

  it("calls onChange with 'all' when all filter is pressed", () => {
    const onChange = jest.fn();
    render(<PriorityFilterBar active="high" onChange={onChange} />);

    fireEvent.press(screen.getByText("messages.filterAll"));
    expect(onChange).toHaveBeenCalledWith("all");
  });

  it("calls onChange with 'low' when low filter is pressed", () => {
    const onChange = jest.fn();
    render(<PriorityFilterBar active="all" onChange={onChange} />);

    fireEvent.press(screen.getByText("priority.low"));
    expect(onChange).toHaveBeenCalledWith("low");
  });
});
