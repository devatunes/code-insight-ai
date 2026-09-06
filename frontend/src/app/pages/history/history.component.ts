import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AnalysisService } from '../../core/analysis.service';
import type { AnalysisRecord } from '../../core/models';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './history.component.html',
})
export class HistoryComponent implements OnInit {
  records = signal<AnalysisRecord[]>([]);
  loading = signal(true);

  constructor(private readonly analysis: AnalysisService) {}

  ngOnInit(): void {
    this.analysis.listRecent().subscribe({
      next: (records) => {
        this.records.set(records);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
