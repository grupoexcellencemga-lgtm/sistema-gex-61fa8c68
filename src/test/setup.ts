import "@testing-library/jest-dom";

// jsdom does not implement scrollIntoView — required by Radix Select
Element.prototype.scrollIntoView = () => {};
