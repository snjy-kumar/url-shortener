"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Key, 
  Copy, 
  Trash2, 
  Plus, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Calendar,
  Activity,
  Loader2,
  AlertCircle
} from "lucide-react";
import toast from "react-hot-toast";
import { api } from "@/lib/api";

interface ApiKey {
  id: string;
  key: string;
  name: string;
  lastUsed?: string;
  createdAt: string;
  expiresAt?: string;
  isActive: boolean;
  usageCount: number;
}

export default function SettingsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showKeys, setShowKeys] = useState<{ [key: string]: boolean }>({});
  const [newKeyName, setNewKeyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    fetchApiKeys();
  }, [isAuthenticated, router]);

  const fetchApiKeys = async () => {
    setIsLoading(true);
    try {
      const response = await api.get("/api-keys");
      if (response.data.success) {
        setApiKeys(response.data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch API keys:", error);
      toast.error("Failed to load API keys");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newKeyName.trim()) {
      toast.error("Please enter a name for the API key");
      return;
    }

    setIsCreating(true);

    try {
      const response = await api.post("/api-keys", {
        name: newKeyName,
      });

      if (response.data.success) {
        toast.success("API key created successfully!");
        setNewKeyName("");
        await fetchApiKeys();
        
        // Auto-show the new key
        const newKey = response.data.data;
        if (newKey) {
          setShowKeys({ ...showKeys, [newKey.id]: true });
          
          // Show a dialog with the key
          alert(
            `Your new API key has been created!\n\nKey: ${newKey.key}\n\nMake sure to copy it now. You won't be able to see it again!`
          );
        }
      }
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to create API key");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteApiKey = async (keyId: string, keyName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete the API key "${keyName}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const response = await api.delete(`/api-keys/${keyId}`);
      if (response.data.success) {
        toast.success("API key deleted successfully");
        await fetchApiKeys();
      }
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to delete API key");
    }
  };

  const handleRegenerateApiKey = async (keyId: string, keyName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to regenerate the API key "${keyName}"? The old key will stop working immediately.`
    );

    if (!confirmed) return;

    try {
      const response = await api.put(`/api-keys/${keyId}/regenerate`);
      if (response.data.success) {
        toast.success("API key regenerated successfully!");
        await fetchApiKeys();
        
        // Auto-show the regenerated key
        setShowKeys({ ...showKeys, [keyId]: true });
        
        // Show a dialog with the new key
        const newKey = response.data.data;
        if (newKey) {
          alert(
            `Your API key has been regenerated!\n\nNew Key: ${newKey.key}\n\nMake sure to copy it now. You won't be able to see it again!`
          );
        }
      }
    } catch (error) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Failed to regenerate API key");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const toggleKeyVisibility = (keyId: string) => {
    setShowKeys({ ...showKeys, [keyId]: !showKeys[keyId] });
  };

  const maskKey = (key: string) => {
    if (key.length < 8) return "••••••••";
    return `${key.substring(0, 8)}${"•".repeat(key.length - 8)}`;
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Manage your API keys and application preferences
        </p>
      </div>

      <Tabs defaultValue="api-keys" className="space-y-6">
        <TabsList>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
        </TabsList>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="space-y-6">
          {/* Create New API Key */}
          <Card>
            <CardHeader>
              <CardTitle>Create New API Key</CardTitle>
              <CardDescription>
                Generate a new API key to access the URL shortener API
                programmatically
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateApiKey} className="flex gap-4">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="Enter API key name (e.g., Production App)"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                </div>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Key
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* API Keys List */}
          <Card>
            <CardHeader>
              <CardTitle>Your API Keys</CardTitle>
              <CardDescription>
                Manage your existing API keys. Keep them secure and never share
                them publicly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-8">
                  <Key className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">
                    No API keys yet. Create one to get started!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {apiKeys.map((apiKey) => (
                    <div
                      key={apiKey.id}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg flex items-center gap-2">
                            {apiKey.name}
                            {!apiKey.isActive && (
                              <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                                Inactive
                              </span>
                            )}
                          </h3>
                          <div className="flex items-center gap-2 mt-2">
                            <code className="text-sm bg-muted px-3 py-1 rounded font-mono">
                              {showKeys[apiKey.id]
                                ? apiKey.key
                                : maskKey(apiKey.key)}
                            </code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleKeyVisibility(apiKey.id)}
                            >
                              {showKeys[apiKey.id] ? (
                                <EyeOff className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                copyToClipboard(apiKey.key, "API key")
                              }
                            >
                              <Copy className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleRegenerateApiKey(apiKey.id, apiKey.name)
                            }
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() =>
                              handleDeleteApiKey(apiKey.id, apiKey.name)
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground pt-2 border-t">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>
                            Created:{" "}
                            {new Date(apiKey.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4" />
                          <span>Usage: {apiKey.usageCount || 0} calls</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          <span>
                            Last used:{" "}
                            {apiKey.lastUsed
                              ? new Date(apiKey.lastUsed).toLocaleDateString()
                              : "Never"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* API Documentation Link */}
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-blue-900">
                    API Documentation
                  </h3>
                  <p className="text-sm text-blue-700 mt-1">
                    Learn how to use your API keys to integrate our URL
                    shortener into your applications. Visit our{" "}
                    <a
                      href="/docs/api"
                      className="underline hover:text-blue-800"
                    >
                      API documentation
                    </a>{" "}
                    for detailed guides and examples.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>Application Preferences</CardTitle>
              <CardDescription>
                Customize your URL shortener experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label>Default URL Expiration</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Set a default expiration time for new shortened URLs
                  </p>
                  <select className="w-full border rounded-md p-2">
                    <option value="never">Never expire</option>
                    <option value="1h">1 hour</option>
                    <option value="24h">24 hours</option>
                    <option value="7d">7 days</option>
                    <option value="30d">30 days</option>
                    <option value="90d">90 days</option>
                  </select>
                </div>

                <div>
                  <Label>QR Code Default Size</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Choose the default size for generated QR codes
                  </p>
                  <select className="w-full border rounded-md p-2">
                    <option value="128">Small (128x128)</option>
                    <option value="256" selected>
                      Medium (256x256)
                    </option>
                    <option value="512">Large (512x512)</option>
                    <option value="1024">Extra Large (1024x1024)</option>
                  </select>
                </div>

                <div className="pt-4">
                  <Button className="w-full">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Save Preferences
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
