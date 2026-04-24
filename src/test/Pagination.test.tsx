import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PaginationControls, paginate } from "../components/Pagination";

describe("PaginationControls component", () => {
  it("renders correct number of pages when there are fewer than 5", () => {
    // 30 items, 10 per page = 3 pages
    render(<PaginationControls currentPage={1} totalItems={30} pageSize={10} onPageChange={() => {}} />);
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("disables previous button on first page", () => {
    const { container } = render(<PaginationControls currentPage={1} totalItems={50} pageSize={10} onPageChange={() => {}} />);
    const buttons = container.querySelectorAll("button");
    const prevButton = buttons[0];
    expect(prevButton).toBeDisabled();
  });

  it("disables next button on last page", () => {
    const { container } = render(<PaginationControls currentPage={5} totalItems={50} pageSize={10} onPageChange={() => {}} />);
    const buttons = container.querySelectorAll("button");
    const nextButton = buttons[buttons.length - 1];
    expect(nextButton).toBeDisabled();
  });

  it("calls onPageChange with correct page number when clicked", () => {
    const handlePageChange = vi.fn();
    render(<PaginationControls currentPage={2} totalItems={50} pageSize={10} onPageChange={handlePageChange} />);
    
    // click on page 3 button
    fireEvent.click(screen.getByText("3"));
    expect(handlePageChange).toHaveBeenCalledWith(3);
  });

  it("displays correct item range text", () => {
    render(<PaginationControls currentPage={2} totalItems={25} pageSize={10} onPageChange={() => {}} />);
    // Page 2 of 10 items/page means items 11 to 20 of 25.
    expect(screen.getByText("11–20 de 25")).toBeInTheDocument();
  });

  it("does not render component if total pages <= 1", () => {
    const { container } = render(<PaginationControls currentPage={1} totalItems={10} pageSize={10} onPageChange={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("paginate utility function", () => {
  const items = [1, 2, 3, 4, 5, 6, 7];

  it("returns correct items for page 1", () => {
    expect(paginate(items, 1, 3)).toEqual([1, 2, 3]);
  });

  it("returns correct items for page 2", () => {
    expect(paginate(items, 2, 3)).toEqual([4, 5, 6]);
  });

  it("returns correct items for last page (partial full)", () => {
    expect(paginate(items, 3, 3)).toEqual([7]);
  });

  it("returns empty array for page out of bounds", () => {
    expect(paginate(items, 4, 3)).toEqual([]);
  });

  it("handles empty items array", () => {
    expect(paginate([], 1, 5)).toEqual([]);
  });
});
