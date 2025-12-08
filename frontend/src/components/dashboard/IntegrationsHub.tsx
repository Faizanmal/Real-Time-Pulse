'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Puzzle,
  Github,
  Slack,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Settings,
  Plus,
  ExternalLink,
  Trash2,
  FolderKanban,
  Trello,
  MessageSquare,
  Users,
} from 'lucide-react';
import { api } from '@/lib/api';
import {
  integrationsApi,
  JiraProject,
  TrelloBoard,
  GitHubRepo,
  SlackChannel,
  HubSpotContact,

} from '@/lib/enterprise-api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Integration {
  id: string;
  provider: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  lastSyncAt: string | null;
}

interface IntegrationsHubProps {
  className?: string;
}

export function IntegrationsHub({ className }: IntegrationsHubProps) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [showConnectDialog, setShowConnectDialog] = useState(false);

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      const data = await api.integrations.list();
      // Map NotificationIntegration to our Integration interface
      const mapped: Integration[] = data.map((item) => ({
        id: item.id,
        provider: item.integration_type,
        name: item.name,
        status: item.is_active ? 'active' : 'inactive',
        lastSyncAt: item.updated_at,
      }));
      setIntegrations(mapped);
    } catch (error) {
      console.error('Failed to load integrations:', error);
      toast.error('Failed to load integrations');
    } finally {
      setLoading(false);
    }
  };

  const syncIntegration = async (integrationId: string) => {
    try {
      // Test the integration as a form of sync validation
      await api.integrations.test(integrationId);
      toast.success('Sync started');
      loadIntegrations();
    } catch (error) {
      console.error('Failed to sync integration:', error);
      toast.error('Failed to sync integration');
    }
  };

  const deleteIntegration = async (integrationId: string) => {
    if (!confirm('Are you sure you want to disconnect this integration?')) return;

    try {
      await api.integrations.delete(integrationId);
      setIntegrations(integrations.filter((i) => i.id !== integrationId));
      toast.success('Integration disconnected');
    } catch (error) {
      console.error('Failed to delete integration:', error);
      toast.error('Failed to disconnect integration');
    }
  };

  const availableProviders = [
    { id: 'jira', name: 'Jira', icon: FolderKanban, description: 'Project management and issue tracking' },
    { id: 'trello', name: 'Trello', icon: Trello, description: 'Kanban-style project management' },
    { id: 'github', name: 'GitHub', icon: Github, description: 'Code hosting and version control' },
    { id: 'hubspot', name: 'HubSpot', icon: Users, description: 'CRM and marketing automation' },
    { id: 'slack', name: 'Slack', icon: Slack, description: 'Team communication and notifications' },
  ];

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'jira':
        return FolderKanban;
      case 'trello':
        return Trello;
      case 'github':
        return Github;
      case 'hubspot':
        return Users;
      case 'slack':
        return Slack;
      default:
        return Puzzle;
    }
  };

  if (loading) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-3 gap-4">
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
            <div className="h-32 bg-gray-200 rounded"></div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Puzzle className="h-5 w-5 text-cyan-500" />
          <h3 className="text-lg font-semibold">Integrations Hub</h3>
        </div>
        <Button onClick={() => setShowConnectDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Connect Integration
        </Button>
      </div>

      <Tabs defaultValue="connected">
        <TabsList className="mb-6">
          <TabsTrigger value="connected">Connected ({integrations.length})</TabsTrigger>
          <TabsTrigger value="available">Available</TabsTrigger>
        </TabsList>

        <TabsContent value="connected">
          {integrations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Puzzle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No integrations connected</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setShowConnectDialog(true)}
              >
                Connect Your First Integration
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrations.map((integration) => {
                const Icon = getProviderIcon(integration.provider);
                return (
                  <div
                    key={integration.id}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setSelectedIntegration(integration)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <h4 className="font-medium">{integration.name}</h4>
                          <p className="text-sm text-gray-500 capitalize">
                            {integration.provider}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={integration.status} />
                    </div>
                    {integration.lastSyncAt && (
                      <p className="text-xs text-gray-500">
                        Last synced: {new Date(integration.lastSyncAt).toLocaleString()}
                      </p>
                    )}
                    <div className="flex gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          syncIntegration(integration.id);
                        }}
                      >
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Sync
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteIntegration(integration.id);
                        }}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="available">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableProviders.map((provider) => {
              const isConnected = integrations.some(
                (i) => i.provider.toLowerCase() === provider.id
              );
              return (
                <div key={provider.id} className="border rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-gray-100 rounded-lg">
                      <provider.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="font-medium">{provider.name}</h4>
                      {isConnected && (
                        <Badge variant="default" className="bg-green-500 text-xs">
                          Connected
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">{provider.description}</p>
                  <Button
                    variant={isConnected ? 'outline' : 'default'}
                    size="sm"
                    className="w-full"
                    onClick={() => setShowConnectDialog(true)}
                  >
                    {isConnected ? 'Add Another' : 'Connect'}
                  </Button>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Connect Dialog */}
      <ConnectIntegrationDialog
        open={showConnectDialog}
        onClose={() => setShowConnectDialog(false)}
        onSuccess={() => {
          setShowConnectDialog(false);
          loadIntegrations();
        }}
      />

      {/* Integration Details Dialog */}
      {selectedIntegration && (
        <IntegrationDetailsDialog
          integration={selectedIntegration}
          onClose={() => setSelectedIntegration(null)}
        />
      )}
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    active: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
    inactive: { color: 'bg-gray-100 text-gray-800', icon: AlertCircle },
    error: { color: 'bg-red-100 text-red-800', icon: AlertCircle },
  };

  const { color, icon: Icon } = config[status as keyof typeof config] || config.inactive;

  return (
    <Badge className={cn('gap-1', color)}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  );
}

interface ConnectIntegrationDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

function ConnectIntegrationDialog({ open, onClose, onSuccess }: ConnectIntegrationDialogProps) {
  const [provider, setProvider] = useState('');
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleConnect = async () => {
    if (!provider || !name) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      // Map our provider to the NotificationIntegration format
      const integrationType = provider === 'slack' ? 'slack' : 
                              provider === 'teams' ? 'teams' : 'webhook';
      await api.integrations.create({
        integration_type: integrationType as 'slack' | 'teams' | 'webhook',
        name,
        webhook_url: baseUrl || '',
        is_active: true,
        notify_on_meeting_complete: true,
        notify_on_action_items: true,
        notify_on_mentions: true,
      });
      toast.success('Integration connected successfully');
      onSuccess();
    } catch (error) {
      console.error('Failed to connect integration:', error);
      toast.error('Failed to connect integration');
    } finally {
      setSubmitting(false);
    }
  };

  const getProviderFields = () => {
    switch (provider) {
      case 'jira':
        return (
          <>
            <div>
              <Label htmlFor="baseUrl">Jira URL *</Label>
              <Input
                id="baseUrl"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://your-company.atlassian.net"
              />
            </div>
            <div>
              <Label htmlFor="apiKey">API Token *</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Your Jira API token"
              />
            </div>
          </>
        );
      case 'trello':
        return (
          <div>
            <Label htmlFor="apiKey">API Key *</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Your Trello API key"
            />
          </div>
        );
      case 'github':
        return (
          <div>
            <Label htmlFor="apiKey">Personal Access Token *</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
            />
          </div>
        );
      case 'hubspot':
        return (
          <div>
            <Label htmlFor="apiKey">Private App Token *</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Your HubSpot private app token"
            />
          </div>
        );
      case 'slack':
        return (
          <div>
            <Label htmlFor="apiKey">Bot Token *</Label>
            <Input
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="xoxb-xxxxxxxxxxxx"
            />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Integration</DialogTitle>
          <DialogDescription>
            Connect a third-party service to your workspace
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="provider">Provider *</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger>
                <SelectValue placeholder="Select a provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="jira">Jira</SelectItem>
                <SelectItem value="trello">Trello</SelectItem>
                <SelectItem value="github">GitHub</SelectItem>
                <SelectItem value="hubspot">HubSpot</SelectItem>
                <SelectItem value="slack">Slack</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="name">Integration Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Jira Integration"
            />
          </div>

          {getProviderFields()}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleConnect} disabled={submitting}>
              {submitting ? 'Connecting...' : 'Connect'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface IntegrationDetailsDialogProps {
  integration: Integration;
  onClose: () => void;
}

function IntegrationDetailsDialog({ integration, onClose }: IntegrationDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <Dialog open={!!integration} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {integration.name}
            <StatusBadge status={integration.status} />
          </DialogTitle>
          <DialogDescription>
            {integration.provider.charAt(0).toUpperCase() + integration.provider.slice(1)} Integration
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <h5 className="text-sm font-medium text-gray-500 mb-1">Status</h5>
                  <StatusBadge status={integration.status} />
                </div>
                <div className="border rounded-lg p-4">
                  <h5 className="text-sm font-medium text-gray-500 mb-1">Last Synced</h5>
                  <p>
                    {integration.lastSyncAt
                      ? new Date(integration.lastSyncAt).toLocaleString()
                      : 'Never'}
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="data" className="mt-4">
            <IntegrationDataSection integration={integration} />
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <div className="text-center py-8 text-gray-500">
              <Settings className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Settings configuration coming soon</p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

interface IntegrationDataSectionProps {
  integration: Integration;
}

function IntegrationDataSection({ integration }: IntegrationDataSectionProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<unknown>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let result;
      switch (integration.provider.toLowerCase()) {
        case 'jira':
          result = await integrationsApi.jira.getProjects(integration.id);
          break;
        case 'trello':
          result = await integrationsApi.trello.getBoards(integration.id);
          break;
        case 'github':
          result = await integrationsApi.github.getRepos(integration.id);
          break;
        case 'hubspot':
          result = await integrationsApi.hubspot.getContacts(integration.id);
          break;
        case 'slack':
          result = await integrationsApi.slack.getChannels(integration.id);
          break;
      }
      setData(result);
    } catch (error) {
      console.error('Failed to load integration data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [integration.id, integration.provider]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-24 bg-gray-200 rounded"></div>
        <div className="h-24 bg-gray-200 rounded"></div>
      </div>
    );
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No data available from this integration</p>
      </div>
    );
  }

  switch (integration.provider.toLowerCase()) {
    case 'jira':
      return <JiraDataView data={data as JiraProject[]} />;
    case 'trello':
      return <TrelloDataView data={data as TrelloBoard[]} />;
    case 'github':
      return <GitHubDataView data={data as GitHubRepo[]} />;
    case 'hubspot':
      return <HubSpotDataView data={data as HubSpotContact[]} />;
    case 'slack':
      return <SlackDataView data={data as SlackChannel[]} integrationId={integration.id} />;
    default:
      return <pre className="text-xs">{JSON.stringify(data, null, 2)}</pre>;
  }
}

function JiraDataView({ data }: { data: JiraProject[] }) {
  return (
    <div className="space-y-4">
      <h5 className="font-medium">Projects ({data.length})</h5>
      <div className="border rounded-lg divide-y">
        {data.map((project) => (
          <div key={project.id} className="p-3 flex items-center justify-between">
            <div>
              <span className="font-medium">{project.name}</span>
              <Badge variant="secondary" className="ml-2 text-xs">
                {project.key}
              </Badge>
            </div>
            <Button variant="ghost" size="sm">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrelloDataView({ data }: { data: TrelloBoard[] }) {
  return (
    <div className="space-y-4">
      <h5 className="font-medium">Boards ({data.length})</h5>
      <div className="grid grid-cols-2 gap-4">
        {data.map((board) => (
          <div key={board.id} className="border rounded-lg p-4">
            <h6 className="font-medium">{board.name}</h6>
            <a
              href={board.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-500 hover:underline flex items-center gap-1"
            >
              Open in Trello
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

function GitHubDataView({ data }: { data: GitHubRepo[] }) {
  return (
    <div className="space-y-4">
      <h5 className="font-medium">Repositories ({data.length})</h5>
      <div className="border rounded-lg divide-y">
        {data.map((repo) => (
          <div key={repo.id} className="p-3 flex items-center justify-between">
            <div>
              <span className="font-medium">{repo.fullName}</span>
              {repo.private && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  Private
                </Badge>
              )}
            </div>
            <a
              href={`https://github.com/${repo.fullName}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="ghost" size="sm">
                <Github className="h-4 w-4" />
              </Button>
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}

function HubSpotDataView({ data }: { data: HubSpotContact[] }) {
  return (
    <div className="space-y-4">
      <h5 className="font-medium">Contacts ({data.length})</h5>
      <div className="border rounded-lg divide-y">
        {data.map((contact) => (
          <div key={contact.id} className="p-3">
            <div className="font-medium">
              {contact.firstName || contact.lastName
                ? `${contact.firstName || ''} ${contact.lastName || ''}`.trim()
                : 'Unknown'}
            </div>
            <div className="text-sm text-gray-500">{contact.email}</div>
            {contact.company && (
              <div className="text-sm text-gray-500">{contact.company}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SlackDataView({ data, integrationId }: { data: SlackChannel[]; integrationId: string }) {
  const [message, setMessage] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');
  const [sending, setSending] = useState(false);

  const handleSendMessage = async () => {
    if (!selectedChannel || !message) return;

    setSending(true);
    try {
      await integrationsApi.slack.sendMessage(integrationId, selectedChannel, message);
      toast.success('Message sent');
      setMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <h5 className="font-medium">Channels ({data.length})</h5>
      <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
        {data.map((channel) => (
          <div key={channel.id} className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">#</span>
              <span className="font-medium">{channel.name}</span>
              {channel.isPrivate && (
                <Badge variant="secondary" className="text-xs">
                  Private
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t pt-4">
        <h5 className="font-medium mb-2">Send Message</h5>
        <div className="space-y-3">
          <Select value={selectedChannel} onValueChange={setSelectedChannel}>
            <SelectTrigger>
              <SelectValue placeholder="Select channel" />
            </SelectTrigger>
            <SelectContent>
              {data.map((channel) => (
                <SelectItem key={channel.id} value={channel.id}>
                  #{channel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
          />
          <Button onClick={handleSendMessage} disabled={sending || !selectedChannel || !message}>
            <MessageSquare className="h-4 w-4 mr-2" />
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}
