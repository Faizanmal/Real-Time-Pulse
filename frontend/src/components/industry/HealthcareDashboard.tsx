'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Heart,
  User,
  FileText,
  Activity,
  Shield,
  AlertTriangle,
  Search,
  Plus,
  Clock,
  Stethoscope,
  Pill,
  FlaskConical,
  Lock,
  Eye,
  CheckCircle2,
} from 'lucide-react';

interface Patient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  conditions: { code: string; description: string; status: string }[];
  encounters: number;
  lastVisit: string;
}

interface VitalSigns {
  heartRate: number;
  bloodPressure: string;
  temperature: number;
  oxygenSaturation: number;
  respiratoryRate: number;
}

interface AccessLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  patientId: string;
  reason: string;
}

export default function HealthcareDashboard() {
  const [patients] = useState<Patient[]>([
    {
      id: 'patient-1',
      mrn: 'MRN001234',
      firstName: 'John',
      lastName: 'Smith',
      dateOfBirth: '1965-03-15',
      gender: 'Male',
      conditions: [
        { code: 'E11.9', description: 'Type 2 Diabetes Mellitus', status: 'active' },
        { code: 'I10', description: 'Essential Hypertension', status: 'active' },
      ],
      encounters: 12,
      lastVisit: '2024-01-10',
    },
    {
      id: 'patient-2',
      mrn: 'MRN001235',
      firstName: 'Mary',
      lastName: 'Johnson',
      dateOfBirth: '1978-07-22',
      gender: 'Female',
      conditions: [
        { code: 'J45.909', description: 'Unspecified Asthma', status: 'active' },
      ],
      encounters: 5,
      lastVisit: '2024-01-08',
    },
  ]);

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('patients');

  const [accessLogs] = useState<AccessLog[]>([
    { id: '1', timestamp: '2024-01-15T10:30:00Z', user: 'Dr. Wilson', action: 'view', patientId: 'patient-1', reason: 'Routine checkup' },
    { id: '2', timestamp: '2024-01-15T10:15:00Z', user: 'Nurse Davis', action: 'update', patientId: 'patient-2', reason: 'Vital signs update' },
    { id: '3', timestamp: '2024-01-15T09:45:00Z', user: 'Dr. Chen', action: 'view', patientId: 'patient-1', reason: 'Lab review' },
  ]);

  const [riskAssessment] = useState({
    overallRisk: 'low',
    findings: ['All access controls are functioning properly', 'Encryption standards met'],
    recommendations: ['Schedule quarterly access review', 'Update training materials'],
  });

  const mockVitals: VitalSigns = {
    heartRate: 72,
    bloodPressure: '120/80',
    temperature: 98.6,
    oxygenSaturation: 98,
    respiratoryRate: 16,
  };

  const getConditionStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'resolved': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'inactive': return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  return (
    <div className="p-6 space-y-6 bg-gray-950 min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Heart className="h-8 w-8 text-red-400" />
            Healthcare Solution
          </h1>
          <p className="text-gray-400 mt-1">HIPAA-compliant patient management with HL7/FHIR integration</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="border-green-500/50 text-green-400">
            <Shield className="h-3 w-3 mr-1" />
            HIPAA Compliant
          </Badge>
          <Badge variant="outline" className="border-blue-500/50 text-blue-400">
            <Lock className="h-3 w-3 mr-1" />
            HL7 v2.5 Ready
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-900/50 border border-gray-800">
          <TabsTrigger value="patients">Patient Records</TabsTrigger>
          <TabsTrigger value="vitals">Vitals Monitoring</TabsTrigger>
          <TabsTrigger value="compliance">HIPAA Compliance</TabsTrigger>
          <TabsTrigger value="interoperability">HL7/FHIR</TabsTrigger>
        </TabsList>

        <TabsContent value="patients" className="mt-6">
          <div className="grid grid-cols-3 gap-6">
            {/* Patient List */}
            <Card className="bg-gray-900/50 border-gray-800 col-span-1">
              <CardHeader>
                <CardTitle className="text-white text-lg">Patients</CardTitle>
                <div className="flex gap-2 mt-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                    <Input
                      placeholder="Search by name or MRN..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9 bg-gray-800 border-gray-700"
                    />
                  </div>
                  <Button size="icon" variant="outline">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {patients
                  .filter(p =>
                    `${p.firstName} ${p.lastName} ${p.mrn}`.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map(patient => (
                    <button
                      key={patient.id}
                      onClick={() => setSelectedPatient(patient)}
                      className={`w-full p-3 rounded-lg text-left transition-colors ${
                        selectedPatient?.id === patient.id
                          ? 'bg-red-500/10 border border-red-500/50'
                          : 'bg-gray-800/50 border border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-gray-700">
                          <User className="h-4 w-4 text-gray-300" />
                        </div>
                        <div>
                          <p className="font-medium text-white">
                            {patient.firstName} {patient.lastName}
                          </p>
                          <p className="text-sm text-gray-400">MRN: {patient.mrn}</p>
                        </div>
                      </div>
                    </button>
                  ))}
              </CardContent>
            </Card>

            {/* Patient Details */}
            <Card className="bg-gray-900/50 border-gray-800 col-span-2">
              <CardHeader>
                <CardTitle className="text-white">
                  {selectedPatient
                    ? `${selectedPatient.firstName} ${selectedPatient.lastName}`
                    : 'Select a Patient'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedPatient ? (
                  <div className="space-y-6">
                    {/* Demographics */}
                    <div className="grid grid-cols-4 gap-4 p-4 bg-gray-800/50 rounded-lg">
                      <div>
                        <p className="text-sm text-gray-400">Date of Birth</p>
                        <p className="text-white">{selectedPatient.dateOfBirth}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Gender</p>
                        <p className="text-white">{selectedPatient.gender}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Total Encounters</p>
                        <p className="text-white">{selectedPatient.encounters}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">Last Visit</p>
                        <p className="text-white">{selectedPatient.lastVisit}</p>
                      </div>
                    </div>

                    {/* Active Conditions */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-400 mb-3">Active Conditions</h4>
                      <div className="space-y-2">
                        {selectedPatient.conditions.map((condition, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                          >
                            <div>
                              <p className="text-white">{condition.description}</p>
                              <p className="text-sm text-gray-500">ICD-10: {condition.code}</p>
                            </div>
                            <Badge className={getConditionStatusColor(condition.status)}>
                              {condition.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Stethoscope className="h-4 w-4 mr-2" />
                        New Encounter
                      </Button>
                      <Button variant="outline" size="sm">
                        <Pill className="h-4 w-4 mr-2" />
                        Medications
                      </Button>
                      <Button variant="outline" size="sm">
                        <FlaskConical className="h-4 w-4 mr-2" />
                        Lab Results
                      </Button>
                      <Button variant="outline" size="sm">
                        <FileText className="h-4 w-4 mr-2" />
                        Documents
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    Select a patient to view details
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="vitals" className="mt-6">
          <div className="grid grid-cols-5 gap-4">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="p-4 text-center">
                <Activity className="h-8 w-8 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Heart Rate</p>
                <p className="text-2xl font-bold text-white">{mockVitals.heartRate}</p>
                <p className="text-xs text-gray-500">bpm</p>
              </CardContent>
            </Card>
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="p-4 text-center">
                <Activity className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Blood Pressure</p>
                <p className="text-2xl font-bold text-white">{mockVitals.bloodPressure}</p>
                <p className="text-xs text-gray-500">mmHg</p>
              </CardContent>
            </Card>
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="p-4 text-center">
                <Activity className="h-8 w-8 text-orange-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Temperature</p>
                <p className="text-2xl font-bold text-white">{mockVitals.temperature}</p>
                <p className="text-xs text-gray-500">°F</p>
              </CardContent>
            </Card>
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="p-4 text-center">
                <Activity className="h-8 w-8 text-cyan-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">SpO2</p>
                <p className="text-2xl font-bold text-white">{mockVitals.oxygenSaturation}%</p>
                <p className="text-xs text-gray-500">saturation</p>
              </CardContent>
            </Card>
            <Card className="bg-gray-900/50 border-gray-800">
              <CardContent className="p-4 text-center">
                <Activity className="h-8 w-8 text-purple-400 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Respiratory Rate</p>
                <p className="text-2xl font-bold text-white">{mockVitals.respiratoryRate}</p>
                <p className="text-xs text-gray-500">breaths/min</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="compliance" className="mt-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Access Logs */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  PHI Access Logs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {accessLogs.map(log => (
                  <div key={log.id} className="p-3 bg-gray-800/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-medium">{log.user}</p>
                        <p className="text-sm text-gray-400">{log.action} - {log.reason}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-400">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </p>
                        <p className="text-xs text-gray-500">Patient: {log.patientId}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Risk Assessment */}
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  HIPAA Risk Assessment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                    <span className="text-green-400 font-medium">Overall Risk: Low</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Findings</h4>
                  <ul className="space-y-1">
                    {riskAssessment.findings.map((finding, i) => (
                      <li key={i} className="text-sm text-gray-300 flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3 text-green-400" />
                        {finding}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Recommendations</h4>
                  <ul className="space-y-1">
                    {riskAssessment.recommendations.map((rec, i) => (
                      <li key={i} className="text-sm text-gray-300 flex items-center gap-2">
                        <AlertTriangle className="h-3 w-3 text-yellow-400" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="interoperability" className="mt-6">
          <div className="grid grid-cols-2 gap-6">
            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">HL7 Message Parser</CardTitle>
                <CardDescription>Parse and process HL7 v2.x messages</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-400 mb-2">Sample HL7 Message</p>
                  <div className="p-3 bg-gray-950 rounded font-mono text-xs text-gray-400">
                    MSH|^~\&|HIS|Hospital|LAB|Lab|20240115103000||ADT^A01|MSG001|P|2.5<br/>
                    PID|1||MRN001234||Smith^John||19650315|M<br/>
                    PV1|1|I|ICU^101^A|
                  </div>
                </div>
                <Button>Parse Message</Button>
              </CardContent>
            </Card>

            <Card className="bg-gray-900/50 border-gray-800">
              <CardHeader>
                <CardTitle className="text-white">FHIR Resources</CardTitle>
                <CardDescription>Convert and export to FHIR R4 format</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm">Export Patient</Button>
                  <Button variant="outline" size="sm">Export Encounter</Button>
                  <Button variant="outline" size="sm">Export Observations</Button>
                  <Button variant="outline" size="sm">Export Medications</Button>
                </div>
                <div className="p-3 bg-gray-950 rounded">
                  <p className="text-sm text-gray-400 mb-2">Sample FHIR Patient Resource</p>
                  <pre className="text-xs text-gray-500 overflow-auto">
{`{
  "resourceType": "Patient",
  "id": "patient-1",
  "identifier": [{
    "use": "usual",
    "value": "MRN001234"
  }],
  "name": [{
    "family": "Smith",
    "given": ["John"]
  }]
}`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
