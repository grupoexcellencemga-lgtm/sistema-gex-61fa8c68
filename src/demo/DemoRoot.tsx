import { BrowserRouter } from "react-router-dom";
import DemoApp from "@/demo/DemoApp";

export default function DemoRoot() {
  return (
    <BrowserRouter>
      <DemoApp />
    </BrowserRouter>
  );
}
