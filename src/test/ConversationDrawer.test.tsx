import { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConversationDrawer } from "@/components/funil/ConversationDrawer";

function Inbox() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("Ana");
  return <><input aria-label="Buscar contatos" value={search} onChange={e => setSearch(e.target.value)} /><button onClick={() => setOpen(true)}>Ana</button><ConversationDrawer open={open} onClose={() => setOpen(false)} title="Conversa com Ana"><p>Histórico da conversa</p></ConversationDrawer></>;
}

describe("conversa em painel lateral", () => {
  it("abre pelo contato e volta à lista mantendo a busca", async () => {
    render(<Inbox />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const contact = screen.getByRole("button", { name: "Ana" });
    contact.focus();
    fireEvent.click(contact);
    expect(screen.getByRole("dialog", { name: "Conversa com Ana" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar à lista" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByRole("textbox", { name: "Buscar contatos" })).toHaveValue("Ana");
    await waitFor(() => expect(contact).toHaveFocus());
  });
  it("fecha pelo Escape também no histórico de finalizadas", async () => {
    render(<Inbox />);
    fireEvent.click(screen.getByRole("button", { name: "Ana" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
