import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { DetailsModule } from './modules/details/details.module';
import { TypesModule } from './modules/types/types.module';
import { VersionModule } from './modules/version/version.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env'
    }),
    PrismaModule,
    VersionModule,
    TypesModule,
    DetailsModule
  ]
})
export class AppModule {}
