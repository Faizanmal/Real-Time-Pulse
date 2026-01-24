import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface PatientRecord {
  id: string;
  mrn: string; // Medical Record Number
  demographics: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    address?: any;
    contact?: any;
  };
  encounters: EncounterRecord[];
  conditions: Condition[];
  medications: Medication[];
  vitals: VitalSign[];
  labResults: LabResult[];
  consents: ConsentRecord[];
}

export interface EncounterRecord {
  id: string;
  type: 'inpatient' | 'outpatient' | 'emergency' | 'virtual';
  date: string;
  provider: string;
  facility: string;
  diagnosis: string[];
  procedures: string[];
  notes: string;
}

interface Condition {
  code: string;
  system: 'ICD-10' | 'SNOMED-CT';
  description: string;
  status: 'active' | 'resolved' | 'inactive';
  onsetDate: string;
  severity: 'mild' | 'moderate' | 'severe';
}

interface Medication {
  code: string;
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  status: 'active' | 'completed' | 'stopped';
  startDate: string;
  endDate?: string;
}

interface VitalSign {
  timestamp: string;
  heartRate?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  temperature?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
}

interface LabResult {
  id: string;
  testCode: string;
  testName: string;
  value: number | string;
  unit: string;
  referenceRange: { low: number; high: number };
  status: 'normal' | 'abnormal' | 'critical';
  timestamp: string;
}

interface ConsentRecord {
  id: string;
  type: 'treatment' | 'research' | 'data_sharing' | 'hipaa';
  status: 'granted' | 'denied' | 'withdrawn';
  grantedDate: string;
  expirationDate?: string;
  scope: string[];
}

export interface HL7Message {
  type: 'ADT' | 'ORM' | 'ORU' | 'SIU' | 'MDM' | 'RDE';
  version: '2.3' | '2.4' | '2.5' | '2.5.1';
  segments: Record<string, any>[];
}

interface FHIRResource {
  resourceType: string;
  id: string;
  meta: { versionId: string; lastUpdated: string };
  [key: string]: any;
}

export interface AccessLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  action: 'view' | 'create' | 'update' | 'delete' | 'export';
  resourceType: string;
  resourceId: string;
  patientId: string;
  accessReason: string;
  ipAddress: string;
  successful: boolean;
}

interface BreachNotification {
  id: string;
  incidentDate: string;
  discoveryDate: string;
  reportDate: string;
  affectedRecords: number;
  description: string;
  status: 'investigating' | 'reported' | 'resolved';
}

export interface RiskAssessment {
  id: string;
  date: string;
  category: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  findings: string[];
  mitigations: string[];
}

@Injectable()
export class HealthcareSolutionService {
  private readonly logger = new Logger(HealthcareSolutionService.name);
  private readonly patients = new Map<string, PatientRecord>();
  private readonly accessLog: AccessLogEntry[] = [];
  private readonly breachNotifications: BreachNotification[] = [];

  constructor(private readonly eventEmitter: EventEmitter2) {}

  // Patient Management
  async createPatient(
    data: Omit<
      PatientRecord,
      'id' | 'encounters' | 'conditions' | 'medications' | 'vitals' | 'labResults' | 'consents'
    >,
  ): Promise<PatientRecord> {
    const id = `patient-${Date.now()}`;
    const patient: PatientRecord = {
      ...data,
      id,
      encounters: [],
      conditions: [],
      medications: [],
      vitals: [],
      labResults: [],
      consents: [],
    };

    this.patients.set(id, patient);
    this.logger.log(`Created patient record: ${patient.mrn}`);

    this.eventEmitter.emit('healthcare.patient.created', { patientId: id });
    return patient;
  }

  async getPatient(
    id: string,
    userId: string,
    accessReason: string,
  ): Promise<PatientRecord | undefined> {
    const patient = this.patients.get(id);

    // Log access for HIPAA compliance
    this.logAccess({
      userId,
      action: 'view',
      resourceType: 'Patient',
      resourceId: id,
      patientId: id,
      accessReason,
      successful: !!patient,
    });

    return patient;
  }

  async searchPatients(query: {
    mrn?: string;
    name?: string;
    dateOfBirth?: string;
  }): Promise<PatientRecord[]> {
    const results: PatientRecord[] = [];

    for (const patient of this.patients.values()) {
      if (query.mrn && patient.mrn === query.mrn) {
        results.push(patient);
        continue;
      }
      if (query.name) {
        const fullName =
          `${patient.demographics.firstName} ${patient.demographics.lastName}`.toLowerCase();
        if (fullName.includes(query.name.toLowerCase())) {
          results.push(patient);
          continue;
        }
      }
      if (query.dateOfBirth && patient.demographics.dateOfBirth === query.dateOfBirth) {
        results.push(patient);
      }
    }

    return results;
  }

  // Clinical Data
  async addEncounter(
    patientId: string,
    encounter: Omit<EncounterRecord, 'id'>,
  ): Promise<EncounterRecord> {
    const patient = this.patients.get(patientId);
    if (!patient) throw new Error(`Patient ${patientId} not found`);

    const record: EncounterRecord = {
      ...encounter,
      id: `enc-${Date.now()}`,
    };

    patient.encounters.push(record);
    this.eventEmitter.emit('healthcare.encounter.created', {
      patientId,
      encounterId: record.id,
    });

    return record;
  }

  async addVitals(patientId: string, vitals: VitalSign): Promise<void> {
    const patient = this.patients.get(patientId);
    if (!patient) throw new Error(`Patient ${patientId} not found`);

    patient.vitals.push(vitals);

    // Check for critical values
    if (vitals.heartRate && (vitals.heartRate < 40 || vitals.heartRate > 150)) {
      this.eventEmitter.emit('healthcare.vitals.critical', {
        patientId,
        type: 'heartRate',
        value: vitals.heartRate,
      });
    }

    if (vitals.oxygenSaturation && vitals.oxygenSaturation < 90) {
      this.eventEmitter.emit('healthcare.vitals.critical', {
        patientId,
        type: 'oxygenSaturation',
        value: vitals.oxygenSaturation,
      });
    }
  }

  async addLabResult(patientId: string, result: Omit<LabResult, 'id'>): Promise<LabResult> {
    const patient = this.patients.get(patientId);
    if (!patient) throw new Error(`Patient ${patientId} not found`);

    const labResult: LabResult = {
      ...result,
      id: `lab-${Date.now()}`,
    };

    patient.labResults.push(labResult);

    if (labResult.status === 'critical') {
      this.eventEmitter.emit('healthcare.lab.critical', {
        patientId,
        testName: labResult.testName,
        value: labResult.value,
      });
    }

    return labResult;
  }

  // HL7 Integration
  async parseHL7Message(rawMessage: string): Promise<HL7Message> {
    const lines = rawMessage.split('\r').filter((l) => l.length > 0);
    const segments: Record<string, any>[] = [];

    for (const line of lines) {
      const fields = line.split('|');
      const segmentType = fields[0];

      segments.push({
        type: segmentType,
        fields: fields.slice(1),
      });
    }

    const mshSegment = segments.find((s) => s.type === 'MSH');
    const messageType = mshSegment?.fields[7]?.split('^')[0] || 'ADT';
    const version = mshSegment?.fields[10] || '2.5';

    return {
      type: messageType as HL7Message['type'],
      version: version as HL7Message['version'],
      segments,
    };
  }

  async processHL7Message(message: HL7Message): Promise<void> {
    this.logger.log(`Processing HL7 ${message.type} message`);

    switch (message.type) {
      case 'ADT': // Admit/Discharge/Transfer
        await this.processADT(message);
        break;
      case 'ORU': // Observation Result
        await this.processORU(message);
        break;
      case 'ORM': // Order Message
        await this.processORM(message);
        break;
      default:
        this.logger.warn(`Unsupported HL7 message type: ${message.type}`);
    }
  }

  private async processADT(message: HL7Message): Promise<void> {
    const pidSegment = message.segments.find((s) => s.type === 'PID');
    if (!pidSegment) return;

    // Extract patient demographics from PID segment
    const fields = pidSegment.fields;
    const mrn = fields[2] || '';
    const _name = fields[4]?.split('^') || [];

    this.logger.log(`Processed ADT for patient: ${mrn}`);
  }

  private async processORU(message: HL7Message): Promise<void> {
    const obxSegments = message.segments.filter((s) => s.type === 'OBX');

    for (const obx of obxSegments) {
      const fields = obx.fields;
      const testCode = fields[2]?.split('^')[0];
      const value = fields[4];

      this.logger.log(`Processed lab result: ${testCode} = ${value}`);
    }
  }

  private async processORM(message: HL7Message): Promise<void> {
    const orcSegment = message.segments.find((s) => s.type === 'ORC');
    if (!orcSegment) return;

    const orderControl = orcSegment.fields[0];
    this.logger.log(`Processed order with control: ${orderControl}`);
  }

  // FHIR Integration
  async convertToFHIR(patient: PatientRecord): Promise<FHIRResource> {
    return {
      resourceType: 'Patient',
      id: patient.id,
      meta: {
        versionId: '1',
        lastUpdated: new Date().toISOString(),
      },
      identifier: [
        {
          use: 'usual',
          system: 'urn:oid:mrn',
          value: patient.mrn,
        },
      ],
      name: [
        {
          use: 'official',
          family: patient.demographics.lastName,
          given: [patient.demographics.firstName],
        },
      ],
      gender: patient.demographics.gender,
      birthDate: patient.demographics.dateOfBirth,
      active: true,
    };
  }

  async importFHIRResource(resource: FHIRResource): Promise<void> {
    if (resource.resourceType === 'Patient') {
      const name = resource.name?.[0] || {};
      await this.createPatient({
        mrn: resource.identifier?.[0]?.value || '',
        demographics: {
          firstName: name.given?.[0] || '',
          lastName: name.family || '',
          dateOfBirth: resource.birthDate,
          gender: resource.gender,
        },
      });
    }

    this.logger.log(`Imported FHIR ${resource.resourceType}`);
  }

  // HIPAA Compliance
  private logAccess(entry: Omit<AccessLogEntry, 'id' | 'timestamp' | 'ipAddress'>): void {
    const logEntry: AccessLogEntry = {
      ...entry,
      id: `access-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ipAddress: '0.0.0.0', // Would be actual IP in production
    };

    this.accessLog.push(logEntry);

    // Keep only last 100000 entries
    if (this.accessLog.length > 100000) {
      this.accessLog.shift();
    }
  }

  async getAccessLogs(filters: {
    patientId?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    action?: AccessLogEntry['action'];
  }): Promise<AccessLogEntry[]> {
    return this.accessLog.filter((log) => {
      if (filters.patientId && log.patientId !== filters.patientId) return false;
      if (filters.userId && log.userId !== filters.userId) return false;
      if (filters.action && log.action !== filters.action) return false;
      if (filters.startDate && log.timestamp < filters.startDate) return false;
      if (filters.endDate && log.timestamp > filters.endDate) return false;
      return true;
    });
  }

  async reportBreach(
    notification: Omit<BreachNotification, 'id' | 'reportDate'>,
  ): Promise<BreachNotification> {
    const breach: BreachNotification = {
      ...notification,
      id: `breach-${Date.now()}`,
      reportDate: new Date().toISOString(),
    };

    this.breachNotifications.push(breach);

    this.logger.error(`HIPAA breach reported: ${breach.description}`);
    this.eventEmitter.emit('healthcare.breach.reported', breach);

    return breach;
  }

  async conductRiskAssessment(): Promise<RiskAssessment> {
    const findings: string[] = [];
    const mitigations: string[] = [];
    let riskLevel: RiskAssessment['riskLevel'] = 'low';

    // Check for various risk factors
    const recentBreaches = this.breachNotifications.filter(
      (b) => new Date(b.reportDate) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    );

    if (recentBreaches.length > 0) {
      findings.push(`${recentBreaches.length} breaches in last 90 days`);
      riskLevel = 'high';
      mitigations.push('Implement additional access controls');
    }

    // Check access patterns
    const bulkExports = this.accessLog.filter(
      (log) =>
        log.action === 'export' &&
        new Date(log.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    );

    if (bulkExports.length > 100) {
      findings.push('High volume of data exports detected');
      riskLevel = riskLevel === 'low' ? 'medium' : riskLevel;
      mitigations.push('Review export policies and add approvals');
    }

    const assessment: RiskAssessment = {
      id: `risk-${Date.now()}`,
      date: new Date().toISOString(),
      category: 'Privacy and Security',
      riskLevel,
      findings,
      mitigations,
    };

    return assessment;
  }

  // Analytics
  async getPatientAnalytics(): Promise<{
    totalPatients: number;
    encountersByType: Record<string, number>;
    conditionsByStatus: Record<string, number>;
    averageEncountersPerPatient: number;
  }> {
    const patients = Array.from(this.patients.values());

    const encountersByType: Record<string, number> = {};
    const conditionsByStatus: Record<string, number> = {};
    let totalEncounters = 0;

    for (const patient of patients) {
      for (const encounter of patient.encounters) {
        encountersByType[encounter.type] = (encountersByType[encounter.type] || 0) + 1;
        totalEncounters++;
      }
      for (const condition of patient.conditions) {
        conditionsByStatus[condition.status] = (conditionsByStatus[condition.status] || 0) + 1;
      }
    }

    return {
      totalPatients: patients.length,
      encountersByType,
      conditionsByStatus,
      averageEncountersPerPatient: patients.length > 0 ? totalEncounters / patients.length : 0,
    };
  }
}
