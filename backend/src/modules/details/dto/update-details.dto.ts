import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateDetailsDataDto {
  @ApiPropertyOptional({ description: '编码' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '编码不能为空' })
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ description: '项目名称' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '项目名称不能为空' })
  @MaxLength(200)
  projectName?: string;

  @ApiPropertyOptional({ description: '工作内容' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  workContent?: string;

  @ApiPropertyOptional({ description: '乙方承包商' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contractor?: string;

  @ApiPropertyOptional({ description: '计算规则' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  calcRule?: string;

  @ApiPropertyOptional({ description: '计量单位' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: '计量单位不能为空' })
  @MaxLength(50)
  unit?: string;

  @ApiPropertyOptional({ description: '排序序号' })
  @IsOptional()
  @IsInt()
  @Min(0)
  index?: number;

  @ApiPropertyOptional({ description: '状态：0 废弃，1 启用' })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: '状态只能是 0 或 1' })
  status?: number;
}

export class UpdateDetailsDto {
  @ApiProperty({ type: UpdateDetailsDataDto })
  @ValidateNested()
  @Type(() => UpdateDetailsDataDto)
  data!: UpdateDetailsDataDto;
}
