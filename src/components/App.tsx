import React, { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Play, RotateCcw, Square, Trash2, Upload, Snowflake } from "lucide-react"
import { generateKeyset } from "@/lib/frost"
import { ipcRenderer } from 'electron';
import { SimplePool } from 'nostr-tools'

const App: React.FC = () => {
  const [isSignerRunning, setIsSignerRunning] = useState(false);
  const [keysetGenerated, setKeysetGenerated] = useState<{ success: boolean; location: string | null }>({ success: false, location: null });
  const [isGenerating, setIsGenerating] = useState(false);
  const [isServerStarting, setIsServerStarting] = useState(false);
  const [nsecKey, setNsecKey] = useState("");
  const [relays, setRelays] = useState<string[]>([]);
  const [newRelay, setNewRelay] = useState("");
  const [totalKeys, setTotalKeys] = useState<number>(3);
  const [threshold, setThreshold] = useState<number>(2);

  // todo: make this dynamic based off share pubkeys
  const WATCHED_PUBKEYS = [
    'f33c8a9617cb15f705fc70cd461cfd6eaf22f9e24c33eabad981648e5ec6f741',
    '676c02247668d5b18479be3d1a80933044256f3fbd03640a8c234684e641b6d6'
  ];

  useEffect(() => {
    if (keysetGenerated.success) {
      const timer = setTimeout(() => {
        setKeysetGenerated({ success: false, location: null });
        setIsGenerating(false);
      }, 8000);

      return () => clearTimeout(timer);
    }
  }, [keysetGenerated.success]);

  const handleGenerateKeyset = async () => {
    setIsGenerating(true);
    const result = await generateKeyset();
    setKeysetGenerated(result);
  };

  const handleNsecImport = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Importing nsec:", nsecKey);
  };

  const handleAddRelay = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRelay && !relays.includes(newRelay)) {
      setRelays([...relays, newRelay]);
      setNewRelay("");
    }
  };

  const handleRemoveRelay = (relayToRemove: string) => {
    setRelays(relays.filter(relay => relay !== relayToRemove));
  };

  const startRelayPoolSubscription = (relayUrls: string[]) => {
    const pool = new SimplePool();
    
    pool.subscribeMany(
      relayUrls,
      [{
        kinds: [69420],
        authors: WATCHED_PUBKEYS
      }],
      {
        onevent(event) {
          console.log('Received kind 69420 event:', event);
        },
        oneose() {
          console.log('Relay pool subscription completed');
        }
      }
    );
  };

  const handleStartRemoteSigner = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0 && relays.length >= 2) {
      setIsServerStarting(true);
      try {
        await ipcRenderer.invoke('start-server', { relays });
        setIsSignerRunning(true);
        startRelayPoolSubscription(relays);
      } catch (error) {
        console.error('Failed to start server:', error);
      } finally {
        setIsServerStarting(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 to-blue-950 text-blue-100 p-8 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <div className="flex items-center justify-center mb-12">
          <Snowflake className="w-10 h-10 mr-3" />
          <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-300 to-cyan-300">Igloo</h1>
        </div>
        <p className="mb-12 text-blue-400 text-center max-w-xl mx-auto text-sm">
          Frostr keyset generator, rotator, and remote signer.
        </p>

        <Tabs defaultValue="generate" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8 bg-gray-900/50">
            <TabsTrigger value="generate" className="text-sm py-2 text-blue-400 data-[state=active]:bg-blue-900/60 data-[state=active]:text-blue-200">Generate Keyset</TabsTrigger>
            <TabsTrigger value="edit" className="text-sm py-2 text-blue-400 data-[state=active]:bg-blue-900/60 data-[state=active]:text-blue-200">Edit Keyset</TabsTrigger>
            <TabsTrigger value="share" className="text-sm py-2 text-blue-400 data-[state=active]:bg-blue-900/60 data-[state=active]:text-blue-200">Edit Share</TabsTrigger>
            <TabsTrigger value="signer" className="text-sm py-2 text-blue-400 data-[state=active]:bg-blue-900/60 data-[state=active]:text-blue-200">Remote Signer</TabsTrigger>
          </TabsList>
          <TabsContent value="generate">
            <Card className="bg-gray-900/30 border-blue-900/30 backdrop-blur-sm shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl text-blue-200">Keyset Management</CardTitle>
                <CardDescription className="text-blue-400 text-sm">Generate your Frostr keyset</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-blue-200 text-sm font-medium mb-2">Generate new nostr keyset</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="space-y-2">
                      <label htmlFor="gen-total-keys" className="text-blue-200 text-sm font-medium">
                        Total Keys
                      </label>
                      <Input
                        id="gen-total-keys"
                        type="number"
                        min={2}
                        value={totalKeys}
                        onChange={(e) => setTotalKeys(Number(e.target.value))}
                        className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="gen-threshold" className="text-blue-200 text-sm font-medium">
                        Threshold
                      </label>
                      <Input
                        id="gen-threshold"
                        type="number"
                        min={2}
                        max={totalKeys}
                        value={threshold}
                        onChange={(e) => setThreshold(Number(e.target.value))}
                        className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <Button 
                    onClick={handleGenerateKeyset} 
                    className="w-full py-5 bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-sm font-medium hover:opacity-90 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isGenerating}
                  >
                    {isGenerating ? "Generating..." : "Generate Keyset"}
                  </Button>
                </div>

                <div>
                  <h3 className="text-blue-200 text-sm font-medium mb-2">Import existing nsec</h3>
                  <form onSubmit={handleNsecImport} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label htmlFor="import-total-keys" className="text-blue-200 text-sm font-medium">
                          Total Keys
                        </label>
                        <Input
                          id="import-total-keys"
                          type="number"
                          min={2}
                          value={totalKeys}
                          onChange={(e) => setTotalKeys(Number(e.target.value))}
                          className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="import-threshold" className="text-blue-200 text-sm font-medium">
                          Threshold
                        </label>
                        <Input
                          id="import-threshold"
                          type="number"
                          min={2}
                          max={totalKeys}
                          value={threshold}
                          onChange={(e) => setThreshold(Number(e.target.value))}
                          className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <Input
                      type="text"
                      placeholder="Enter your nsec..."
                      value={nsecKey}
                      onChange={(e) => setNsecKey(e.target.value)}
                      className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
                    />
                    <Button 
                      type="submit"
                      className="w-full py-5 bg-purple-600 hover:bg-purple-700 transition-colors duration-200 text-sm font-medium"
                    >
                      Import Key
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="edit">
            <Card className="bg-gray-900/30 border-blue-900/30 backdrop-blur-sm shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl text-blue-200">Edit Keyset</CardTitle>
                <CardDescription className="text-blue-400 text-sm">Modify your existing Frostr keyset configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-4">
                  <h3 className="text-blue-200 text-sm font-medium">Edit Keyset Configuration</h3>
                  <div className="relative">
                    <Input
                      id="edit-file"
                      type="file"
                      className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 pl-10 text-sm file:text-blue-300"
                    />
                    <Upload className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400" size={16} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="total-keys" className="text-blue-200 text-sm font-medium">
                        Total Keys
                      </label>
                      <Input
                        id="total-keys"
                        type="number"
                        min={2}
                        value={totalKeys}
                        onChange={(e) => setTotalKeys(Number(e.target.value))}
                        className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="threshold" className="text-blue-200 text-sm font-medium">
                        Threshold
                      </label>
                      <Input
                        id="threshold"
                        type="number"
                        min={2}
                        max={totalKeys}
                        value={threshold}
                        onChange={(e) => setThreshold(Number(e.target.value))}
                        className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <Button className="w-full py-5 bg-blue-600 hover:bg-blue-700 transition-colors duration-200 text-sm font-medium">
                    Update Keyset
                  </Button>
                </div>

                <div className="space-y-4">
                  <h3 className="text-blue-200 text-sm font-medium">Rotate Keyset</h3>
                  <div className="relative">
                    <Input
                      id="rotate-file"
                      type="file"
                      className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 pl-10 text-sm file:text-blue-300"
                    />
                    <Upload className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400" size={16} />
                  </div>
                  <Button className="w-full py-5 bg-purple-600 hover:bg-purple-700 transition-colors duration-200 text-sm font-medium">
                    Rotate Keyset
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="share">
            <Card className="bg-gray-900/30 border-blue-900/30 backdrop-blur-sm shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl text-blue-200">Share Management</CardTitle>
                <CardDescription className="text-blue-400 text-sm">Add, remove, or recover shares from your keyset</CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-2">
                  <h3 className="text-blue-200 text-sm font-medium">Add Share</h3>
                  <div className="relative">
                    <Input
                      type="file"
                      className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 pl-10 text-sm file:text-blue-300"
                    />
                    <Upload className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400" size={16} />
                  </div>
                  <Button className="w-full bg-green-600 hover:bg-green-700">
                    Add Share
                  </Button>
                </div>

                <div className="space-y-2">
                  <h3 className="text-blue-200 text-sm font-medium">Remove Share</h3>
                  <div className="relative">
                    <Input
                      type="file"
                      className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 pl-10 text-sm file:text-blue-300"
                    />
                    <Upload className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400" size={16} />
                  </div>
                  <Button className="w-full bg-red-600 hover:bg-red-700">
                    Remove Share
                  </Button>
                </div>

                <div className="space-y-2">
                  <h3 className="text-blue-200 text-sm font-medium">Recover Share</h3>
                  <div className="relative">
                    <Input
                      type="file"
                      className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 pl-10 text-sm file:text-blue-300"
                    />
                    <Upload className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400" size={16} />
                  </div>
                  <Button className="w-full bg-yellow-600 hover:bg-yellow-700">
                    Recover Share
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signer">
            <Card className="bg-gray-900/30 border-blue-900/30 backdrop-blur-sm shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl text-blue-200">Remote Signer</CardTitle>
                <CardDescription className="text-blue-400 text-sm">Setup / Manage your remote signer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-blue-200 text-sm font-medium mb-2">Add Nostr Relays (minimum 2)</h3>
                    <form onSubmit={handleAddRelay} className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="wss://relay.example.com"
                        value={newRelay}
                        onChange={(e) => setNewRelay(e.target.value)}
                        className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 text-sm flex-1"
                      />
                      <Button 
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        Add
                      </Button>
                    </form>
                  </div>

                  {relays.length > 0 && (
                    <div className="space-y-2">
                      {relays.map((relay) => (
                        <div key={relay} className="flex items-center justify-between bg-gray-800/30 p-2 rounded-md">
                          <span className="text-blue-300 text-sm font-mono">{relay}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveRelay(relay)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="relative">
                    <Input
                      id="signer-file"
                      type="file"
                      className="bg-gray-800/50 border-gray-700/50 text-blue-300 py-2 pl-10 text-sm file:text-blue-300"
                      onChange={handleStartRemoteSigner}
                      disabled={isServerStarting || isSignerRunning || relays.length < 2}
                    />
                    <Upload className="absolute left-3 top-1/2 transform -translate-y-1/2 text-blue-400" size={16} />
                  </div>
                </div>

                {relays.length < 2 && (
                  <div className="bg-yellow-900/20 p-3 rounded-md flex items-center justify-center border border-yellow-700/30">
                    <span className="text-yellow-300 text-sm">Please add at least 2 relays to continue</span>
                  </div>
                )}

                {isServerStarting && (
                  <div className="bg-blue-900/20 p-3 rounded-md flex items-center justify-center border border-blue-700/30">
                    <span className="text-blue-300 text-sm">Starting server...</span>
                  </div>
                )}
                {isSignerRunning && (
                  <div className="bg-green-900/20 p-3 rounded-md flex flex-col space-y-2 border border-green-700/30">
                    <div className="flex items-center space-x-2">
                      <CheckCircle2 className="text-green-400" size={16} />
                      <span className="text-green-300 text-sm">Remote Signer Running</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-green-300 text-sm">Listening on relays:</span>
                      {relays.map((relay) => (
                        <div key={relay} className="text-green-400 font-mono text-sm pl-4">
                          {relay}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
              {isSignerRunning && (
                <CardFooter className="flex justify-between pt-6">
                  <Button variant="outline" size="icon" onClick={() => {
                    setIsSignerRunning(false);
                  }} className="bg-gray-800/30 border-gray-700/50 hover:bg-gray-700/50">
                    <Square className="h-4 w-4 text-blue-300" />
                  </Button>
                </CardFooter>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default App;
