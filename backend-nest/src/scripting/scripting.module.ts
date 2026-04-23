import { Module } from '@nestjs/common';

import { CacheModule } from '../cache/cache.module';
import { PrismaModule } from '../prisma/prisma.module';

import { ScriptLibraryService } from './script-library.service';
import { ScriptSandboxService } from './script-sandbox.service';
import { ScriptingController } from './scripting.controller';
import { ScriptingService } from './scripting.service';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [ScriptingController],
  providers: [ScriptingService, ScriptSandboxService, ScriptLibraryService],
  exports: [ScriptingService, ScriptSandboxService],
})
export class ScriptingModule {}
