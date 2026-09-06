import { Injectable, NotImplementedException } from '@nestjs/common';
import type { ClonedRepo } from './ingestion.types.js';

/**
 * Cascarón: la entrada por ZIP queda con la interfaz lista (mismo contrato
 * que GitCloneService, un ClonedRepo con cleanup) para que analysis.service
 * ya pueda invocarla sin cambios el día que se complete. Pendiente:
 * recibir el buffer del archivo, descomprimirlo a un directorio temporal
 * con los mismos límites de tamaño/tiempo que el clone de Git.
 */
@Injectable()
export class ZipUploadService {
  async extract(_fileBuffer: Buffer): Promise<ClonedRepo> {
    throw new NotImplementedException('La carga de ZIP todavía no está implementada — usá una URL Git pública.');
  }
}
