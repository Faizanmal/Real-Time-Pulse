import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { ScriptSandboxService } from './script-sandbox.service';
import { ScriptLibraryService } from './script-library.service';

interface CreateScriptDto {
  name: string;
  description?: string;
  code: string;
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
  isPublic?: boolean;
  tags?: string[];
}

interface UpdateScriptDto {
  name?: string;
  description?: string;
  code?: string;
  inputSchema?: Record<string, any>;
  outputSchema?: Record<string, any>;
  isPublic?: boolean;
  tags?: string[];
}

interface ExecuteScriptDto {
  input?: Record<string, any>;
  widgetData?: any;
  portalData?: any;
}

export interface ScriptVersion {
  version: number;
  code: string;
  createdAt: Date;
  createdBy: string;
  comment?: string;
}

@Injectable()
export class ScriptingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly sandbox: ScriptSandboxService,
    private readonly library: ScriptLibraryService,
  ) {}

  /**
   * Create a new script
   */
  async createScript(
    workspaceId: string,
    userId: string,
    dto: CreateScriptDto,
  ) {
    // Validate code before saving
    const validationResult = await this.validateScript(dto.code);
    if (!validationResult.valid) {
      throw new BadRequestException(
        `Invalid script: ${validationResult.errors.join(', ')}`,
      );
    }

    // Store script in cache (since we don't have a Script model in Prisma yet)
    const scriptId = `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const script = {
      id: scriptId,
      workspaceId,
      createdById: userId,
      name: dto.name,
      description: dto.description,
      code: dto.code,
      inputSchema: dto.inputSchema || {},
      outputSchema: dto.outputSchema || {},
      isPublic: dto.isPublic || false,
      tags: dto.tags || [],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save script
    await this.cache.set(
      `script:${workspaceId}:${scriptId}`,
      JSON.stringify(script),
      86400 * 30, // 30 days
    );

    // Add to workspace scripts index
    const scriptsIndex = await this.getWorkspaceScriptsIndex(workspaceId);
    scriptsIndex.push(scriptId);
    await this.cache.set(
      `scripts:index:${workspaceId}`,
      JSON.stringify(scriptsIndex),
      86400 * 30,
    );

    // Save initial version
    await this.saveScriptVersion(workspaceId, scriptId, {
      version: 1,
      code: dto.code,
      createdAt: new Date(),
      createdBy: userId,
      comment: 'Initial version',
    });

    return script;
  }

  /**
   * Get all scripts for a workspace
   */
  async getWorkspaceScripts(workspaceId: string) {
    const scriptsIndex = await this.getWorkspaceScriptsIndex(workspaceId);

    const scripts = await Promise.all(
      scriptsIndex.map(async (scriptId) => {
        const scriptJson = await this.cache.get(
          `script:${workspaceId}:${scriptId}`,
        );
        return scriptJson ? JSON.parse(scriptJson) : null;
      }),
    );

    return scripts.filter(Boolean);
  }

  /**
   * Get a script by ID
   */
  async getScript(workspaceId: string, scriptId: string) {
    const scriptJson = await this.cache.get(
      `script:${workspaceId}:${scriptId}`,
    );

    if (!scriptJson) {
      throw new NotFoundException('Script not found');
    }

    return JSON.parse(scriptJson);
  }

  /**
   * Update a script
   */
  async updateScript(
    workspaceId: string,
    scriptId: string,
    userId: string,
    dto: UpdateScriptDto,
  ) {
    const script = await this.getScript(workspaceId, scriptId);

    // Validate new code if provided
    if (dto.code) {
      const validationResult = await this.validateScript(dto.code);
      if (!validationResult.valid) {
        throw new BadRequestException(
          `Invalid script: ${validationResult.errors.join(', ')}`,
        );
      }

      // Save new version if code changed
      if (dto.code !== script.code) {
        script.version += 1;
        await this.saveScriptVersion(workspaceId, scriptId, {
          version: script.version,
          code: dto.code,
          createdAt: new Date(),
          createdBy: userId,
        });
      }
    }

    // Update script
    const updatedScript = {
      ...script,
      ...dto,
      updatedAt: new Date(),
    };

    await this.cache.set(
      `script:${workspaceId}:${scriptId}`,
      JSON.stringify(updatedScript),
      86400 * 30,
    );

    return updatedScript;
  }

  /**
   * Delete a script
   */
  async deleteScript(workspaceId: string, scriptId: string) {
    // Remove script
    await this.cache.del(`script:${workspaceId}:${scriptId}`);

    // Remove from index
    const scriptsIndex = await this.getWorkspaceScriptsIndex(workspaceId);
    const newIndex = scriptsIndex.filter((id) => id !== scriptId);
    await this.cache.set(
      `scripts:index:${workspaceId}`,
      JSON.stringify(newIndex),
      86400 * 30,
    );

    // Remove versions
    await this.cache.del(`script:versions:${workspaceId}:${scriptId}`);

    return { success: true };
  }

  /**
   * Execute a script
   */
  async executeScript(
    workspaceId: string,
    scriptId: string,
    dto: ExecuteScriptDto,
  ) {
    const script = await this.getScript(workspaceId, scriptId);

    // Validate input against schema
    if (script.inputSchema && Object.keys(script.inputSchema).length > 0) {
      const validation = this.sandbox.validateInput(
        dto.input || {},
        script.inputSchema,
      );
      if (!validation.valid) {
        throw new BadRequestException(
          `Invalid input: ${validation.errors.join(', ')}`,
        );
      }
    }

    // Get library functions
    const libraries = this.library.getLibraries();

    // Create execution context
    const context = {
      // Input data
      input: dto.input || {},
      widgetData: dto.widgetData,
      portalData: dto.portalData,

      // Library functions
      ...libraries,

      // Helper to return result
      result: null as any,
      setResult: (value: any) => {
        context.result = value;
      },
    };

    // Execute script
    const executionResult = await this.sandbox.executeScript(
      script.code,
      context,
      { timeout: 10000 }, // 10 second timeout
    );

    // Log execution
    await this.logExecution(workspaceId, scriptId, {
      success: executionResult.success,
      executionTime: executionResult.executionTime,
      error: executionResult.error,
    });

    if (!executionResult.success) {
      throw new BadRequestException(
        `Script execution failed: ${executionResult.error}`,
      );
    }

    return {
      success: true,
      result: context.result ?? executionResult.result,
      executionTime: executionResult.executionTime,
    };
  }

  /**
   * Validate a script without executing it
   */
  async validateScript(
    code: string,
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Try to parse the code
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      new Function(code);
    } catch (error: any) {
      errors.push(`Syntax error: ${error.message}`);
    }

    // Check for common issues
    if (code.includes('while(true)') || code.includes('while (true)')) {
      errors.push('Infinite loops are not allowed');
    }

    if (code.length > 100000) {
      errors.push('Script exceeds maximum size limit');
    }

    // Security checks
    const securityIssues = this.checkSecurityIssues(code);
    errors.push(...securityIssues);

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check for security issues in code
   */
  private checkSecurityIssues(code: string): string[] {
    const issues: string[] = [];

    const dangerousPatterns = [
      { pattern: /require\s*\(/g, message: 'require() is not allowed' },
      { pattern: /import\s+/g, message: 'import statements are not allowed' },
      { pattern: /eval\s*\(/g, message: 'eval() is not allowed' },
      {
        pattern: /Function\s*\(/g,
        message: 'Function constructor is not allowed',
      },
      { pattern: /process\./g, message: 'process object is not allowed' },
      { pattern: /global\./g, message: 'global object is not allowed' },
      { pattern: /__proto__/g, message: '__proto__ is not allowed' },
      {
        pattern: /constructor\s*\[/g,
        message: 'constructor access is not allowed',
      },
    ];

    for (const { pattern, message } of dangerousPatterns) {
      if (pattern.test(code)) {
        issues.push(message);
      }
    }

    return issues;
  }

  /**
   * Get script versions
   */
  async getScriptVersions(
    workspaceId: string,
    scriptId: string,
  ): Promise<ScriptVersion[]> {
    const versionsJson = await this.cache.get(
      `script:versions:${workspaceId}:${scriptId}`,
    );
    return versionsJson ? JSON.parse(versionsJson) : [];
  }

  /**
   * Rollback to a specific version
   */
  async rollbackScript(
    workspaceId: string,
    scriptId: string,
    version: number,
    userId: string,
  ) {
    const versions = await this.getScriptVersions(workspaceId, scriptId);
    const targetVersion = versions.find((v) => v.version === version);

    if (!targetVersion) {
      throw new NotFoundException(`Version ${version} not found`);
    }

    return this.updateScript(workspaceId, scriptId, userId, {
      code: targetVersion.code,
    });
  }

  /**
   * Get available library functions
   */
  getAvailableLibraries() {
    const libraries = this.library.getLibraries();

    // Return library documentation
    return Object.entries(libraries).map(([name, functions]) => ({
      name,
      functions: Object.keys(functions).map((fnName) => ({
        name: fnName,
        signature: functions[fnName].toString().split('{')[0].trim(),
      })),
    }));
  }

  /**
   * Helper: Get workspace scripts index
   */
  private async getWorkspaceScriptsIndex(
    workspaceId: string,
  ): Promise<string[]> {
    const indexJson = await this.cache.get(`scripts:index:${workspaceId}`);
    return indexJson ? JSON.parse(indexJson) : [];
  }

  /**
   * Helper: Save script version
   */
  private async saveScriptVersion(
    workspaceId: string,
    scriptId: string,
    version: ScriptVersion,
  ) {
    const versions = await this.getScriptVersions(workspaceId, scriptId);
    versions.push(version);

    // Keep last 50 versions
    const trimmedVersions = versions.slice(-50);

    await this.cache.set(
      `script:versions:${workspaceId}:${scriptId}`,
      JSON.stringify(trimmedVersions),
      86400 * 30,
    );
  }

  /**
   * Helper: Log script execution
   */
  private async logExecution(
    workspaceId: string,
    scriptId: string,
    data: { success: boolean; executionTime: number; error?: string },
  ) {
    const logsJson = await this.cache.get(
      `script:logs:${workspaceId}:${scriptId}`,
    );
    const logs = logsJson ? JSON.parse(logsJson) : [];

    logs.push({
      ...data,
      timestamp: new Date(),
    });

    // Keep last 100 logs
    const trimmedLogs = logs.slice(-100);

    await this.cache.set(
      `script:logs:${workspaceId}:${scriptId}`,
      JSON.stringify(trimmedLogs),
      86400 * 7, // 7 days
    );
  }
}
