import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** Isola falhas inesperadas de uma seção para não derrubar o painel inteiro. */
export class SectionBoundary extends Component<{ name: string; children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  override componentDidCatch(error: unknown) { console.error(`Falha na seção ${this.props.name}:`, error); }
  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        <span>Não foi possível exibir {this.props.name}. O restante do painel continua funcionando.</span>
        <Button variant="outline" size="sm" onClick={() => this.setState({ failed: false })}>Tentar de novo</Button>
      </div>
    );
  }
}
