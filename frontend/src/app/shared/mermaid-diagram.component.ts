import { AfterViewInit, Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import mermaid from 'mermaid';

let mermaidInitialized = false;

/** Wrapper mínimo del paquete `mermaid` — renderiza el texto recibido como SVG. */
@Component({
  selector: 'app-mermaid-diagram',
  standalone: true,
  template: `<div #container class="mermaid-diagram"></div>`,
})
export class MermaidDiagramComponent implements AfterViewInit, OnChanges {
  @Input({ required: true }) diagram = '';
  @ViewChild('container', { static: true }) container!: ElementRef<HTMLDivElement>;

  private viewReady = false;

  ngAfterViewInit(): void {
    this.viewReady = true;
    void this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['diagram'] && this.viewReady) {
      void this.render();
    }
  }

  private async render(): Promise<void> {
    if (!this.diagram) return;

    if (!mermaidInitialized) {
      mermaid.initialize({ startOnLoad: false, theme: 'neutral' });
      mermaidInitialized = true;
    }

    try {
      const id = `mermaid-${Math.random().toString(36).slice(2)}`;
      const { svg } = await mermaid.render(id, this.diagram);
      this.container.nativeElement.innerHTML = svg;
    } catch {
      this.container.nativeElement.textContent =
        'No se pudo renderizar el diagrama de arquitectura.';
    }
  }
}
