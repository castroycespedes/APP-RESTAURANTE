import { Type } from 'class-transformer';
import { IsArray, ValidateNested } from 'class-validator';
import { CreateSettingDto } from './create-setting.dto';

export class BulkUpsertSettingsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSettingDto)
  settings!: CreateSettingDto[];
}
