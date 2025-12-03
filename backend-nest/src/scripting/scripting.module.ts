import { Module } from '@nestjs/common';
import { ScriptingService } from './scripting.service';
import { ScriptingController } from './scripting.controller';
import { ScriptSandboxService } from './script-sandbox.service';
import { ScriptLibraryService } from './script-library.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [ScriptingController],
  providers: [ScriptingService, ScriptSandboxService, ScriptLibraryService],
  exports: [ScriptingService, ScriptSandboxService],
})
export class ScriptingModule {}
