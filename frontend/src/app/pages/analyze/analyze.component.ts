import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AnalysisService } from '../../core/analysis.service';

@Component({
  selector: 'app-analyze',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './analyze.component.html',
})
export class AnalyzeComponent {
  repoUrl = '';
  loading = signal(false);
  error = signal<string | null>(null);

  constructor(
    private readonly analysis: AnalysisService,
    private readonly router: Router,
  ) {}

  submit(): void {
    if (!this.repoUrl.trim()) return;

    this.loading.set(true);
    this.error.set(null);

    this.analysis.analyzeRepo(this.repoUrl.trim()).subscribe({
      next: (record) => {
        this.loading.set(false);
        void this.router.navigate(['/result', record.id]);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'No se pudo analizar el repositorio.');
      },
    });
  }
}
