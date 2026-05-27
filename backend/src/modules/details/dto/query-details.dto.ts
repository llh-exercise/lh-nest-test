import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class QueryDetailsDto {
  @ApiPropertyOptional({ description: '分类标识，按分类筛选明细' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  typeId?: string;
}
