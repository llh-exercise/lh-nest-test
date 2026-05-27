import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class UpdateVersionDataDto {
  @ApiPropertyOptional({ description: '版本名称' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ description: '状态：0 未启用，1 启用' })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: '状态只能是 0 或 1' })
  status?: number;
}

export class UpdateVersionDto {
  @ApiProperty({ type: UpdateVersionDataDto })
  @ValidateNested()
  @Type(() => UpdateVersionDataDto)
  data!: UpdateVersionDataDto;
}
