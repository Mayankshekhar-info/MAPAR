import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { LoginForm } from "../components/LoginForm";

describe("LoginForm Component", () => {
  it("renders username, password, remember me, and submit button", () => {
    const handleSubmit = vi.fn();
    const handleClearError = vi.fn();

    render(
      <LoginForm
        onSubmit={handleSubmit}
        isSubmitting={false}
        errorMessage={null}
        onClearError={handleClearError}
      />
    );

    expect(screen.getByLabelText(/Username or Corporate Email/i)).toBeDefined();
    expect(screen.getByLabelText(/^Password$/i)).toBeDefined();
    expect(screen.getByRole("checkbox", { name: /Remember me on this workstation/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Sign in to Platform/i })).toBeDefined();
  });

  it("displays error message when provided", () => {
    const handleSubmit = vi.fn();
    const handleClearError = vi.fn();

    render(
      <LoginForm
        onSubmit={handleSubmit}
        isSubmitting={false}
        errorMessage="Invalid username or password. Please check your credentials."
        onClearError={handleClearError}
      />
    );

    expect(
      screen.getByText(/Invalid username or password\. Please check your credentials\./i)
    ).toBeDefined();
  });

  it("shows loading state when isSubmitting is true", () => {
    const handleSubmit = vi.fn();
    const handleClearError = vi.fn();

    render(
      <LoginForm
        onSubmit={handleSubmit}
        isSubmitting={true}
        errorMessage={null}
        onClearError={handleClearError}
      />
    );

    expect(screen.getByText(/Authenticating\.\.\./i)).toBeDefined();
  });

  it("submits the form with entered credentials", async () => {
    const handleSubmit = vi.fn();
    const handleClearError = vi.fn();

    render(
      <LoginForm
        onSubmit={handleSubmit}
        isSubmitting={false}
        errorMessage={null}
        onClearError={handleClearError}
      />
    );

    const usernameInput = screen.getByLabelText(/Username or Corporate Email/i);
    const passwordInput = screen.getByLabelText(/^Password$/i);
    const submitBtn = screen.getByRole("button", { name: /Sign in to Platform/i });

    fireEvent.change(usernameInput, { target: { value: "lead@telecrats.in" } });
    fireEvent.change(passwordInput, { target: { value: "CorporatePass123" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith({
        username: "lead@telecrats.in",
        password: "CorporatePass123",
        rememberMe: false,
      });
    });
  });
});
