; ─────────────────────────────────────────────────────────────────────────
;  BuenaMezcla Tótem — Inno Setup installer
;  Builds: BuenaMezclaTotem-Setup.exe
;
;  Requirements on the build machine:
;    • Inno Setup 6+   (https://jrsoftware.org/isdl.php)
;    • Node.js 20 portable (vendored under .\vendor\node\)
;    • NSSM           (https://nssm.cc) vendored under .\vendor\nssm\
;    • The compiled app under .\payload\  (run windows\build-payload.ps1)
;
;  At install time the user provides:
;    • Cloud URL
;    • Bootstrap token  (generated in admin panel → Tótems → "+ Instalar nuevo tótem")
;    • Casino UUID
;    • Tótem name
;
;  The installer:
;    1. Copies payload + vendor/{node,nssm} into C:\BuenaMezcla
;    2. Runs `node totem/register.js` to register against the cloud
;    3. Installs NSSM service "BuenaMezclaTotem" pointing at runtime.js
;    4. Adds Chrome shortcut in Startup with --kiosk http://127.0.0.1:5000
;    5. Adds a Scheduled Task that runs updater.cmd every 30 min
; ─────────────────────────────────────────────────────────────────────────

#define MyAppName    "BuenaMezcla Tótem"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "BuenaMezcla"
#define InstallDir   "C:\BuenaMezcla"

[Setup]
AppId={{C4B5A7F1-4A11-4D9E-9E8E-D2F5BA5B3C20}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={#InstallDir}
DefaultGroupName={#MyAppName}
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=admin
OutputBaseFilename=BuenaMezclaTotem-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
ArchitecturesInstallIn64BitMode=x64
SetupLogging=yes

[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"

[Files]
; App payload (server bundle, totem runtime, schemas, public assets)
Source: "payload\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
; Vendored Node.js portable
Source: "vendor\node\*"; DestDir: "{app}\node"; Flags: ignoreversion recursesubdirs
; Vendored NSSM service wrapper
Source: "vendor\nssm\nssm.exe"; DestDir: "{app}\nssm"; Flags: ignoreversion
; Helper scripts
Source: "scripts\register.cmd";  DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "scripts\start-kiosk.cmd"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "scripts\updater.cmd";   DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "scripts\install-service.cmd"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "scripts\uninstall-service.cmd"; DestDir: "{app}\scripts"; Flags: ignoreversion

[Dirs]
Name: "{app}\totem-data"; Permissions: users-modify
Name: "{app}\logs"; Permissions: users-modify

[Code]
var
  CloudPage: TInputQueryWizardPage;
  TotemPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  CloudPage := CreateInputQueryPage(wpSelectDir,
    'Conexión con la nube',
    'Datos del servidor central de BuenaMezcla',
    'Indicá la URL del servidor y el token de instalación generado en el panel admin.');
  CloudPage.Add('URL del cloud (ej. https://app.buenamezcla.cl):', False);
  CloudPage.Add('Token de instalación:', False);
  CloudPage.Values[0] := 'https://app.buenamezcla.cl';

  TotemPage := CreateInputQueryPage(CloudPage.ID,
    'Identidad del tótem',
    'Casino y nombre',
    'Indicá el UUID del casino al que pertenece este tótem y un nombre amigable.');
  TotemPage.Add('UUID del casino:', False);
  TotemPage.Add('Nombre del tótem (ej. Tótem Comedor 1):', False);
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
  if CurPageID = CloudPage.ID then begin
    if (Trim(CloudPage.Values[0]) = '') or (Trim(CloudPage.Values[1]) = '') then begin
      MsgBox('Completá URL y token.', mbError, MB_OK);
      Result := False;
    end;
  end;
  if CurPageID = TotemPage.ID then begin
    if (Trim(TotemPage.Values[0]) = '') or (Trim(TotemPage.Values[1]) = '') then begin
      MsgBox('Completá casino y nombre.', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

function GetCloudUrl(Param: string): string;  begin Result := CloudPage.Values[0]; end;
function GetToken(Param: string): string;     begin Result := CloudPage.Values[1]; end;
function GetCasinoId(Param: string): string;  begin Result := TotemPage.Values[0]; end;
function GetTotemName(Param: string): string; begin Result := TotemPage.Values[1]; end;

[Run]
; 1) Register this PC against the cloud (writes totem_id/secret into local SQLite)
Filename: "{app}\scripts\register.cmd"; \
  Parameters: """{code:GetCloudUrl}"" ""{code:GetToken}"" ""{code:GetCasinoId}"" ""{code:GetTotemName}"" ""{#MyAppVersion}"""; \
  WorkingDir: "{app}"; \
  StatusMsg: "Registrando tótem contra la nube..."; \
  Flags: runhidden waituntilterminated

; 2) Install Windows service
Filename: "{app}\scripts\install-service.cmd"; \
  WorkingDir: "{app}"; \
  StatusMsg: "Instalando servicio Windows..."; \
  Flags: runhidden waituntilterminated

; 3) Schedule auto-updater every 30 min
Filename: "schtasks.exe"; \
  Parameters: "/Create /F /SC MINUTE /MO 30 /RU SYSTEM /TN BuenaMezclaTotemUpdater /TR ""{app}\scripts\updater.cmd"""; \
  Flags: runhidden waituntilterminated

; 4) Add kiosk launcher to autostart
Filename: "schtasks.exe"; \
  Parameters: "/Create /F /SC ONLOGON /RL HIGHEST /TN BuenaMezclaTotemKiosk /TR ""{app}\scripts\start-kiosk.cmd"""; \
  Flags: runhidden waituntilterminated

; 5) Optional: launch immediately
Filename: "{app}\scripts\start-kiosk.cmd"; Description: "Iniciar modo kiosk ahora"; Flags: nowait postinstall skipifsilent unchecked

[UninstallRun]
Filename: "{app}\scripts\uninstall-service.cmd"; Flags: runhidden
Filename: "schtasks.exe"; Parameters: "/Delete /F /TN BuenaMezclaTotemUpdater"; Flags: runhidden
Filename: "schtasks.exe"; Parameters: "/Delete /F /TN BuenaMezclaTotemKiosk"; Flags: runhidden

[UninstallDelete]
Type: filesandordirs; Name: "{app}\logs"
; Note: totem-data/ is NOT deleted on uninstall to preserve unsynced pedidos.
