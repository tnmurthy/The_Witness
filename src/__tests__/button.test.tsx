import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

describe("Button", () => {
  it("renders its children and responds to clicks", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Publish issue</Button>);
    const button = screen.getByRole("button", { name: "Publish issue" });

    await user.click(button);
    expect(handleClick).toHaveBeenCalledOnce();
  });

  it("is disabled and non-interactive when the disabled prop is set", async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Button onClick={handleClick} disabled>
        Generate issue
      </Button>
    );
    const button = screen.getByRole("button", { name: "Generate issue" });

    expect(button).toBeDisabled();
    await user.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });
});
