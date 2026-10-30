import { describe, it, expect, vi } from "vitest";
import React from "react";
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EditWeeklyScheduleDialog, formatTime12h } from "../components/EditWeeklyScheduleDialog";
import { ScheduleStatusCard } from "../components/ScheduleStatusCard";
import { ScheduleOverview } from "../types/notifications.types";

describe("formatTime12h helper", () => {
  it("correctly converts 24-hour time to 12-hour formatted time with AM/PM", () => {
    expect(formatTime12h("10:00")).toBe("10:00 AM");
    expect(formatTime12h("13:00")).toBe("01:00 PM");
    expect(formatTime12h("17:00")).toBe("05:00 PM");
    expect(formatTime12h("00:00")).toBe("12:00 AM");
    expect(formatTime12h("12:00")).toBe("12:00 PM");
  });
});

describe("EditWeeklyScheduleDialog Component", () => {
  const mockSchedule = {
    Friday: ["10:00"],
    Saturday: ["09:00", "17:00"],
    Sunday: ["09:00", "13:00", "17:00"],
  };

  it("renders modal with header and all 7 days of the week", () => {
    render(
      <EditWeeklyScheduleDialog
        open={true}
        onClose={vi.fn()}
        currentSchedule={mockSchedule}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText("Edit Weekly Recurring Reminder Schedule")).toBeInTheDocument();
    expect(screen.getByText("Friday")).toBeInTheDocument();
    expect(screen.getByText("Saturday")).toBeInTheDocument();
    expect(screen.getByText("Sunday")).toBeInTheDocument();
    expect(screen.getByText("Monday")).toBeInTheDocument();
    expect(screen.getByText("Tuesday")).toBeInTheDocument();
    expect(screen.getByText("Wednesday")).toBeInTheDocument();
    expect(screen.getByText("Thursday")).toBeInTheDocument();
  });

  it("displays existing scheduled slots formatted as chips", () => {
    render(
      <EditWeeklyScheduleDialog
        open={true}
        onClose={vi.fn()}
        currentSchedule={mockSchedule}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText("10:00 AM IST")).toBeInTheDocument();
    expect(screen.getByText("01:00 PM IST")).toBeInTheDocument();
    expect(screen.getAllByText("09:00 AM IST").length).toBe(2); // Saturday and Sunday
  });

  it("prevents adding duplicate time slots for the same day and displays an error alert", () => {
    render(
      <EditWeeklyScheduleDialog
        open={true}
        onClose={vi.fn()}
        currentSchedule={mockSchedule}
        onSave={vi.fn()}
      />
    );

    // Friday has 10:00 AM already. Let's find Friday's Add Time Slot button.
    const addButtons = screen.getAllByRole("button", { name: /Add Time Slot/i });
    // First active enabled day is Friday (since Mon-Thu are disabled)
    fireEvent.click(addButtons[0]);

    // Default select value is 09:00, which adds 09:00 AM. Now let's try to add 09:00 again.
    fireEvent.click(addButtons[0]);

    expect(screen.getByText(/already exists for Friday/i)).toBeInTheDocument();
  });

  it("submits the updated schedule on Save Schedule", async () => {
    const handleSave = vi.fn().mockResolvedValue({ success: true });
    const handleClose = vi.fn();

    render(
      <EditWeeklyScheduleDialog
        open={true}
        onClose={handleClose}
        currentSchedule={mockSchedule}
        onSave={handleSave}
      />
    );

    const saveButton = screen.getByRole("button", { name: /Save Schedule/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith(
        expect.objectContaining({
          Friday: ["10:00"],
          Saturday: ["09:00", "17:00"],
          Sunday: ["09:00", "13:00", "17:00"],
        })
      );
    });
  });
});

describe("ScheduleStatusCard Component integration", () => {
  const mockOverview: ScheduleOverview = {
    current_ist_time: "2026-10-30 17:00:00 IST",
    current_day: "Friday",
    is_within_permitted_window: true,
    matching_slot: "Friday:10:00",
    schedule_matrix: {
      Friday: ["10:00"],
      Saturday: ["09:00", "13:00", "17:00"],
      Sunday: ["09:00", "12:00", "15:00", "18:00"],
    },
    eligible_unclosed_tasks: 12,
    overdue_tasks: 4,
    past_7_days_sent: 25,
    past_7_days_failed: 0,
    past_7_days_retrying: 0,
  };

  it("renders Edit Weekly Schedule button and dynamic reminder count", () => {
    render(
      <ScheduleStatusCard
        overview={mockOverview}
        isLoading={false}
        onTriggerNow={vi.fn()}
        isTriggering={false}
        onUpdateSchedule={vi.fn()}
      />
    );

    // Check dynamic total calculation (1 + 3 + 4 = 8)
    expect(screen.getByText("Weekly Scheduled Matrix (8 Reminders / Week)")).toBeInTheDocument();

    // Check Edit Weekly Schedule button is rendered
    const editBtn = screen.getByRole("button", { name: /Edit Weekly Schedule/i });
    expect(editBtn).toBeInTheDocument();

    // Check Force Run Reminder Cycle Now button is preserved
    const forceRunBtn = screen.getByRole("button", { name: /Force Run Reminder Cycle Now/i });
    expect(forceRunBtn).toBeInTheDocument();
  });

  it("opens the EditWeeklyScheduleDialog when Edit Weekly Schedule button is clicked", () => {
    render(
      <ScheduleStatusCard
        overview={mockOverview}
        isLoading={false}
        onTriggerNow={vi.fn()}
        isTriggering={false}
        onUpdateSchedule={vi.fn()}
      />
    );

    const editBtn = screen.getByRole("button", { name: /Edit Weekly Schedule/i });
    fireEvent.click(editBtn);

    expect(screen.getByText("Edit Weekly Recurring Reminder Schedule")).toBeInTheDocument();
  });
});
