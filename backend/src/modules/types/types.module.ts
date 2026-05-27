import { Module } from '@nestjs/common';

import { DetailsModule } from '../details/details.module';
import { TypesController } from './types.controller';
import { TypesService } from './types.service';

@Module({
  imports: [DetailsModule],
  controllers: [TypesController],
  providers: [TypesService],
  exports: [TypesService]
})
export class TypesModule {}
