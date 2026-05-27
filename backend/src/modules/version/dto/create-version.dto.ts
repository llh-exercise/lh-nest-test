import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVersionDataDto {
  @ApiProperty({ description: '版本名称' })
  @IsString()
  @IsNotEmpty({ message: '名称不能为空' })
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ description: '状态：0 未启用，1 启用', default: 0 })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: '状态只能是 0 或 1' })
  status?: number;
}

export class CreateVersionDto {
  @ApiProperty({ type: CreateVersionDataDto })
  @ValidateNested()
  @Type(() => CreateVersionDataDto)
  data!: CreateVersionDataDto;
}
