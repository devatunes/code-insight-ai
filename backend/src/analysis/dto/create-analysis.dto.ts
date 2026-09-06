import { IsString, IsNotEmpty, IsUrl } from 'class-validator';

export class CreateAnalysisDto {
  @IsString()
  @IsNotEmpty()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  repoUrl: string;
}
