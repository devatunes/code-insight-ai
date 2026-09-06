import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/analyze/analyze.component').then((m) => m.AnalyzeComponent),
  },
  {
    path: 'result/:id',
    loadComponent: () => import('./pages/result/result.component').then((m) => m.ResultComponent),
  },
  {
    path: 'history',
    loadComponent: () => import('./pages/history/history.component').then((m) => m.HistoryComponent),
  },
  { path: '**', redirectTo: '' },
];
