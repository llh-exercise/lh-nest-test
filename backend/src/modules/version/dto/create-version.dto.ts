import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';

export class CreateVersionDataDto {
  @ApiProperty({ description: '版本名称' })
  /** 校验值必须是字符串类型（拒绝 number、object 等） */
  @IsString()
  /** 校验字符串不能为空：不能是 ''、null、undefined，且纯空格也算空 */
  @IsNotEmpty({ message: '名称不能为空' })
  /** 校验字符串最大长度不超过 200 个字符 */
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ description: '状态：0 未启用，1 启用', default: 0 })
  /** 字段可选：未传该字段时跳过其后所有校验；传了则必须满足后续规则 */
  @IsOptional()
  /** 校验值必须是整数（如 1 通过，1.5 不通过） */
  @IsInt()
  /** 校验值必须在给定枚举列表内，此处只允许 0 或 1 */
  @IsIn([0, 1], { message: '状态只能是 0 或 1' })
  status?: number;
}

export class CreateVersionDto {
  @ApiProperty({ type: CreateVersionDataDto })
  /** 校验嵌套对象：对 data 内部的 CreateVersionDataDto 字段逐一执行校验 */
  @ValidateNested()
  /** 将 plain object 转为 CreateVersionDataDto 实例，ValidateNested 才能生效（class-transformer） */
  @Type(() => CreateVersionDataDto)
  data!: CreateVersionDataDto;
}
