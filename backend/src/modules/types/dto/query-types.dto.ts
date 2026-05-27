import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class QueryTypesDto {
  @ApiPropertyOptional({ description: '版本标识，按版本筛选分类' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  versionId?: string;
}
