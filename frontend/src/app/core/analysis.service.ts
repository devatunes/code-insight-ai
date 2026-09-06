import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import type { AnalysisRecord } from './models';

@Injectable({ providedIn: 'root' })
export class AnalysisService {
  private readonly baseUrl = `${environment.apiUrl}/analyses`;

  constructor(private readonly http: HttpClient) {}

  analyzeRepo(repoUrl: string): Observable<AnalysisRecord> {
    return this.http.post<AnalysisRecord>(this.baseUrl, { repoUrl });
  }

  getById(id: string): Observable<AnalysisRecord> {
    return this.http.get<AnalysisRecord>(`${this.baseUrl}/${id}`);
  }

  listRecent(): Observable<AnalysisRecord[]> {
    return this.http.get<AnalysisRecord[]>(this.baseUrl);
  }
}
