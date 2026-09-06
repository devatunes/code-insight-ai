import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AnalysisService } from '../../core/analysis.service';
import { MermaidDiagramComponent } from '../../shared/mermaid-diagram.component';
import type { AnalysisRecord } from '../../core/models';

@Component({
  selector: 'app-result',
  standalone: true,
  imports: [RouterLink, MermaidDiagramComponent, DatePipe],
  templateUrl: './result.component.html',
})
export class ResultComponent implements OnInit {
  record = signal<AnalysisRecord | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly analysis: AnalysisService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('Falta el id del análisis.');
      this.loading.set(false);
      return;
    }

    this.analysis.getById(id).subscribe({
      next: (record) => {
        this.record.set(record);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se encontró el análisis solicitado.');
        this.loading.set(false);
      },
    });
  }
}
