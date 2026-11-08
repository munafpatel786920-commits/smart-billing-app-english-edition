/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  Camera, 
  X, 
  ScanLine, 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  Zap, 
  ZapOff, 
  CheckCircle2, 
  AlertCircle,
  Sparkles
} from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcodeText: string) => { found: boolean; productName?: string; price?: number } | void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  currencySymbol?: string;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  soundEnabled,
  onToggleSound,
  currencySymbol = '₹'
}) => {
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [availableCameras, setAvailableCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [continuousMode, setContinuousMode] = useState(true);
  const [lastScannedResult, setLastScannedResult] = useState<{
    code: string;
    found: boolean;
    productName?: string;
    price?: number;
    timestamp: number;
  } | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScannedCodeRef = useRef<string>('');
  const lastScanTimeRef = useRef<number>(0);
  const isStoppingRef = useRef<boolean>(false);

  // Play synthesized POS checkout beep
  const playBeep = useCallback((isSuccess = true) => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (isSuccess) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1800, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.12);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(280, ctx.currentTime);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.22);
      }
    } catch {
      // Audio autoplay blocked or unsupported
    }
  }, [soundEnabled]);

  // Safe scanner cleanup
  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      isStoppingRef.current = true;
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch (err) {
        console.warn('Error clearing html5-qrcode scanner:', err);
      } finally {
        scannerRef.current = null;
        isStoppingRef.current = false;
      }
    }
  }, []);

  const handleScanSuccess = useCallback((decodedText: string) => {
    const cleanCode = decodedText.trim();
    if (!cleanCode) return;

    const now = Date.now();
    // Debounce duplicate reads of the exact same barcode within 1.4 seconds
    if (cleanCode === lastScannedCodeRef.current && now - lastScanTimeRef.current < 1400) {
      return;
    }

    lastScannedCodeRef.current = cleanCode;
    lastScanTimeRef.current = now;

    // Trigger mobile vibration if available
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(80);
      } catch {
        // Ignore vibration errors
      }
    }

    // Process scan in parent
    const result = onScan(cleanCode);
    const isFound = result?.found ?? true;

    playBeep(isFound);

    setLastScannedResult({
      code: cleanCode,
      found: isFound,
      productName: result?.productName,
      price: result?.price,
      timestamp: now
    });

    if (!continuousMode) {
      setTimeout(() => {
        onClose();
      }, 350);
    }
  }, [onScan, playBeep, continuousMode, onClose]);

  // Start the scanner
  const startScanner = useCallback(async (cameraId?: string) => {
    try {
      setIsInitializing(true);
      setScannerError(null);
      await stopScanner();

      // Check DOM reader element
      const element = document.getElementById('barcode-live-reader');
      if (!element) {
        throw new Error('Scanner container element not found in DOM.');
      }

      const scanner = new Html5Qrcode('barcode-live-reader', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.ITF
        ],
        verbose: false
      });

      scannerRef.current = scanner;

      // Detect available video cameras
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        throw new Error('No video camera devices found. Ensure webcam or phone camera is enabled.');
      }

      setAvailableCameras(devices.map(d => ({ id: d.id, label: d.label || `Camera ${d.id}` })));

      // Choose back camera (environment) by default on mobile, or first camera
      const targetCameraId = cameraId || 
        devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'))?.id || 
        devices[0].id;

      setSelectedCameraId(targetCameraId);

      const config = {
        fps: 15,
        qrbox: { width: 260, height: 160 },
        aspectRatio: 1.333333
      };

      await scanner.start(
        targetCameraId,
        config,
        (decodedText) => handleScanSuccess(decodedText),
        () => {
          // Frame read loop without detection, safely ignore
        }
      );

      // Check torch capability
      try {
        const capabilities = scanner.getRunningTrackCapabilities();
        if (capabilities && (capabilities as any).torch) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }
      } catch {
        setHasTorch(false);
      }

      setIsInitializing(false);
    } catch (err: any) {
      console.error('Barcode scanner initialization failure:', err);
      setIsInitializing(false);
      setScannerError(err.message || 'Unable to start camera. Please check camera permissions in your browser.');
    }
  }, [stopScanner, handleScanSuccess]);

  // Toggle flashlight / torch
  const handleToggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState } as any]
      });
      setTorchOn(nextState);
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  };

  // Switch camera
  const handleSwitchCamera = (newCamId: string) => {
    setSelectedCameraId(newCamId);
    startScanner(newCamId);
  };

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        startScanner();
      }, 100);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen, startScanner, stopScanner]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-750 text-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        
        {/* Top Header */}
        <div className="p-4 px-5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl">
              <ScanLine className="w-5 h-5 animate-pulse" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold tracking-wide">Live Barcode & QR Scanner</h3>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  POS ACTIVE
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                Point camera at barcode on retail package, box, or item label.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Close Barcode Scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Viewport & Scanning Reticle */}
        <div className="relative bg-black flex-1 min-h-[300px] flex items-center justify-center overflow-hidden">
          
          {/* html5-qrcode container */}
          <div id="barcode-live-reader" className="w-full h-full min-h-[300px]" />

          {/* Reticle Guide Box Overlay (Center) */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="relative w-64 h-40 sm:w-72 sm:h-44 border-2 border-dashed border-emerald-400/70 rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.25)] flex items-center justify-center overflow-hidden">
              
              {/* Corner brackets */}
              <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-emerald-400" />
              <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-emerald-400" />
              <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-emerald-400" />
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-emerald-400" />

              {/* Red laser scanning line animation */}
              <div className="absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_10px_#ef4444] animate-[bounce_2s_infinite]" />
              
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300/80 bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-xs">
                Align Barcode Here
              </span>
            </div>
          </div>

          {/* Loading or Error State */}
          {isInitializing && (
            <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6 space-y-3">
              <Camera className="w-10 h-10 text-blue-400 animate-pulse" />
              <p className="text-xs font-bold text-zinc-200">Starting Optical Camera...</p>
              <p className="text-[11px] text-zinc-400 max-w-xs">
                Please grant camera permissions when prompted by your browser.
              </p>
            </div>
          )}

          {scannerError && (
            <div className="absolute inset-0 bg-zinc-950/90 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6 space-y-3">
              <AlertCircle className="w-10 h-10 text-amber-400" />
              <p className="text-xs font-bold text-amber-200">Camera Notice</p>
              <p className="text-[11px] text-zinc-300 max-w-sm">{scannerError}</p>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => startScanner(selectedCameraId)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors"
                >
                  Retry Camera
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                >
                  Close & Type Code
                </button>
              </div>
            </div>
          )}

          {/* Live Scan Result Notification Badge */}
          {lastScannedResult && Date.now() - lastScannedResult.timestamp < 3000 && (
            <div className="absolute top-4 inset-x-4 flex justify-center z-10 animate-in slide-in-from-top-2 duration-150 pointer-events-none">
              <div className={`px-4 py-2 rounded-xl border text-xs font-bold shadow-xl flex items-center gap-2 backdrop-blur-md ${
                lastScannedResult.found
                  ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                  : 'bg-rose-950/90 border-rose-500/50 text-rose-200'
              }`}>
                {lastScannedResult.found ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Scanned: <strong>{lastScannedResult.productName || lastScannedResult.code}</strong>
                      {lastScannedResult.price !== undefined && (
                        <span className="ml-1 text-emerald-300 font-mono">
                          ({currencySymbol}{lastScannedResult.price})
                        </span>
                      )}
                    </span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>
                      Unknown Barcode: <strong className="font-mono">{lastScannedResult.code}</strong>
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Bottom Toolbar & Settings */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800 space-y-3">
          
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            
            {/* Camera Switcher */}
            {availableCameras.length > 1 && (
              <div className="flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                <select
                  value={selectedCameraId}
                  onChange={(e) => handleSwitchCamera(e.target.value)}
                  className="bg-zinc-850 border border-zinc-750 text-zinc-200 text-[11px] rounded-lg px-2 py-1 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                >
                  {availableCameras.map(cam => (
                    <option key={cam.id} value={cam.id}>{cam.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Quick Action Toggles */}
            <div className="flex items-center gap-2 ml-auto">
              
              {/* Torch button (if device supports) */}
              {hasTorch && (
                <button
                  type="button"
                  onClick={handleToggleTorch}
                  className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                    torchOn ? 'bg-amber-500 text-black' : 'bg-zinc-850 hover:bg-zinc-800 text-zinc-300'
                  }`}
                  title="Flashlight Torch"
                >
                  {torchOn ? <Zap className="w-3.5 h-3.5 fill-black" /> : <ZapOff className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">Torch</span>
                </button>
              )}

              {/* Sound Beep Toggle */}
              <button
                type="button"
                onClick={onToggleSound}
                className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                  soundEnabled 
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' 
                    : 'bg-zinc-850 text-zinc-400'
                }`}
                title="POS Audio Beep On/Off"
              >
                {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{soundEnabled ? 'Beep ON' : 'Muted'}</span>
              </button>

              {/* Continuous Scanning Mode */}
              <button
                type="button"
                onClick={() => setContinuousMode(!continuousMode)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1 ${
                  continuousMode
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-zinc-850 text-zinc-400'
                }`}
                title="Keep scanning multiple items consecutively without closing"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{continuousMode ? 'Multi-Scan ON' : 'Single Scan'}</span>
              </button>

            </div>

          </div>

          <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-zinc-850">
            <span>Supported: EAN-13, EAN-8, Code 128, Code 39, UPC, QR Code</span>
            <button
              type="button"
              onClick={() => {
                stopScanner();
                onClose();
              }}
              className="text-zinc-300 hover:text-white font-bold cursor-pointer underline"
            >
              Done Scanning
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
