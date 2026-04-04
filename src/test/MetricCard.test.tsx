import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MetricCard } from "../components/MetricCard";
import { Activity } from "lucide-react"; // Sample icon

describe("MetricCard component", () => {
  it("renders with basic props", () => {
    render(<MetricCard title="Total Users" value="100" icon={Activity} />);
    expect(screen.getByText("Total Users")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
  });

  it("renders formatted values correctly", () => {
    render(<MetricCard title="Revenue" value="R$ 1.500,00" icon={Activity} />);
    expect(screen.getByText("R$ 1.500,00")).toBeInTheDocument();
  });

  it("shows trend when provided", () => {
    render(<MetricCard title="Sales" value="50" icon={Activity} trend="+5%" />);
    expect(screen.getByText("+5%")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const handleClick = vi.fn();
    const { container } = render(
      <MetricCard title="Clickable" value="10" icon={Activity} onClick={handleClick} />
    );
    fireEvent.click(container.firstChild as HTMLElement);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("applies variant styles correctly", () => {
    const { container } = render(
      <MetricCard title="Danger" value="0" icon={Activity} variant="destructive" />
    );
    // Destructive variant has border-l-destructive
    expect(container.firstChild).toHaveClass("border-l-destructive");
  });
});
