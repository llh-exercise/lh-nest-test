import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested
} from 'class-validator';

export class CreateDetailsDataDto {
  @ApiProperty({ description: '关联分类标识（逻辑外键）' })
  @IsString()
  @IsNotEmpty({ message: '分类标识不能为空' })
  @MaxLength(50)
  typeId!: string;

  @ApiProperty({ description: '编码' })
  @IsString()
  @IsNotEmpty({ message: '编码不能为空' })
  @MaxLength(50)
  code!: string;

  @ApiProperty({ description: '项目名称' })
  @IsString()
  @IsNotEmpty({ message: '项目名称不能为空' })
  @MaxLength(200)
  projectName!: string;

  @ApiPropertyOptional({ description: '工作内容', default: '' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  workContent?: string;

  @ApiPropertyOptional({ description: '乙方承包商', default: '' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  contractor?: string;

  @ApiPropertyOptional({ description: '计算规则', default: '' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  calcRule?: string;

  @ApiProperty({ description: '计量单位' })
  @IsString()
  @IsNotEmpty({ message: '计量单位不能为空' })
  @MaxLength(50)
  unit!: string;

  @ApiPropertyOptional({ description: '排序序号' })
  @IsOptional()
  @IsInt()
  @Min(0)
  index?: number;

  @ApiPropertyOptional({ description: '状态：0 废弃，1 启用', default: 1 })
  @IsOptional()
  @IsInt()
  @IsIn([0, 1], { message: '状态只能是 0 或 1' })
  status?: number;
}

export class CreateDetailsDto {
  @ApiProperty({ type: CreateDetailsDataDto })
  @ValidateNested()
  @Type(() => CreateDetailsDataDto)
  data!: CreateDetailsDataDto;
}
