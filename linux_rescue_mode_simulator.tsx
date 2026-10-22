import React, { useState, useEffect, useRef } from "react";

// Core Guideline Data based on the provided PDF
const GUIDELINE_STEPS = [
  {
    stepNum: 0,
    title: "Step 0: Preparation",
    content: "In VMware, right-click the virtual machine -> Snapshot -> Take Snapshot. Name it 'Before Demo'. (Use the VM menu above)",
    explanation: {
      en: "Taking a snapshot ensures you can easily revert to a working state if you make a mistake during the rescue process.",
      ms: "Mengambil 'snapshot' memastikan anda boleh kembali ke keadaan asal dengan mudah jika berlaku kesilapan semasa proses menyelamat.",
      zh: "拍摄快照可确保在救援过程中出错时，您可以轻松恢复到之前的正常状态。"
    }
  },
  {
    stepNum: 1,
    title: "Step 1: Enter GRUB Menu",
    content: "Reboot the VM. Press the Arrow keys or Esc immediately after boot to stop the 5-second countdown. Select the default kernel and press 'e' to edit.",
    explanation: {
      en: "We interrupt the boot process to access the GRUB menu, allowing us to modify how the Linux kernel starts.",
      ms: "Kita menghentikan proses but automatik untuk mengakses menu GRUB, membolehkan kita mengubah suai cara isirong (kernel) Linux bermula.",
      zh: "我们中断启动过程以进入 GRUB 菜单，从而允许我们修改 Linux 内核的启动参数。"
    }
  },
  {
    stepNum: 2,
    title: "Step 2: Modify Kernel Parameters",
    content: "Find the line starting with linux. Go to the end of this line, add a space, and type 'rd.break'. Press Ctrl + x or F10 to boot.",
    explanation: {
      en: "Adding 'rd.break' tells the system to stop booting before mounting the actual root filesystem, dropping us into an emergency RAM-based environment.",
      ms: "Menambah 'rd.break' mengarahkan sistem untuk berhenti sebelum melekapkan (mount) sistem fail akar sebenar, membawa kita ke persekitaran kecemasan berasaskan RAM.",
      zh: "添加 'rd.break' 会让系统在挂载实际根文件系统之前停止启动，让我们进入基于 RAM 的紧急救援环境。"
    }
  },
  {
    stepNum: 3,
    title: "Step 3: Enter Emergency Shell",
    content: "The system boots into an emergency shell with the prompt switch_root:/#. The real root filesystem is mounted read-only at /sysroot.",
    explanation: {
      en: "This is the initial RAM disk (initramfs) shell. The real system files are currently isolated in /sysroot and are read-only to prevent damage.",
      ms: "Ini adalah shell cakera RAM awal (initramfs). Fail sistem sebenar diasingkan dengan selamat di /sysroot dan berstatus baca-sahaja (read-only).",
      zh: "这是初始 RAM 磁盘 (initramfs) 终端。真实的系统文件被安全地隔离在 /sysroot 中，且目前为只读状态。"
    }
  },
  {
    stepNum: 4,
    title: "Step 4: Remount and Chroot",
    content: "Make the real root filesystem writable:\n`mount -o remount,rw /sysroot`\n\nSwitch to the real system environment:\n`chroot /sysroot`",
    explanation: {
      en: "'remount,rw' makes the files writable so we can change the password. 'chroot' changes our environment so our commands affect the real system.",
      ms: "'remount,rw' membolehkan fail ditulis supaya kita boleh menukar kata laluan. 'chroot' menukar persekitaran supaya arahan kita bertindak ke atas sistem sebenar.",
      zh: "'remount,rw' 使文件变为可写状态，以便我们修改密码。'chroot' 改变我们的环境，使我们的命令直接作用于真实的系统。"
    }
  },
  {
    stepNum: 5,
    title: "Step 5: Reset Password",
    content: "Type the command and follow the prompts. Note: Password input will be invisible (blind typing).\n`passwd root`",
    explanation: {
      en: "We use the 'passwd' command to set a new password for the 'root' superuser. Text is hidden entirely for security purposes.",
      ms: "Kita menggunakan arahan 'passwd' untuk menetapkan kata laluan baru bagi pengguna 'root'. Teks disembunyikan sepenuhnya atas faktor keselamatan.",
      zh: "我们使用 'passwd' 命令为 'root' 超级用户设置新密码。为安全起见，输入的文本会被完全隐藏。"
    }
  },
  {
    stepNum: 6,
    title: "Step 6: Handle SELinux",
    content: "RHEL 8 has SELinux enabled by default. You MUST create the relabel file:\n`touch /.autorelabel`",
    explanation: {
      en: "RHEL uses SELinux. The '/.autorelabel' file forces the system to fix security contexts on the next boot, allowing the new password to actually work.",
      ms: "RHEL menggunakan SELinux. Fail '/.autorelabel' memaksa sistem membetulkan konteks keselamatan pada but seterusnya, membolehkan kata laluan baru berfungsi.",
      zh: "RHEL 默认使用 SELinux。创建 '/.autorelabel' 文件会强制系统在下次启动时修复安全上下文，否则新密码将无法登录。"
    }
  },
  {
    stepNum: 7,
    title: "Step 7: Exit and Reboot",
    content: "Exit chroot, then exit the rescue shell to reboot.\n`exit`\n`exit`\n`# (If necessary)`\n`reboot -f`",
    explanation: {
      en: "Exiting twice leaves the 'chroot' environment and then closes the emergency shell, prompting the system to reboot and apply the SELinux changes.",
      ms: "Keluar (exit) dua kali bermaksud kita meninggalkan persekitaran 'chroot' dan menutup shell kecemasan, mengarahkan sistem but semula untuk mengaplikasikan perubahan.",
      zh: "输入两次 exit 意味着离开 'chroot' 环境，然后关闭紧急 shell，这将促使系统重启并应用 SELinux 更改。"
    }
  },
  {
    stepNum: 8,
    title: "Step 8: Verification",
    content: "Log in to the system. Open terminal, type `su -`, and enter your NEW root password to verify.",
    explanation: {
      en: "We log in normally and use 'su -' to test if the new root password works and switch to the root environment, confirming success.",
      ms: "Kita log masuk seperti biasa dan menggunakan 'su -' untuk menguji sama ada kata laluan root baru berfungsi dan memuatkan persekitaran root.",
      zh: "我们正常登录并使用 'su -' 测试新的 root 密码是否有效，以此最终确认救援操作成功。"
    }
  },
];

const SIM_STATES = {
  PREP: 0,
  GRUB_MENU: 1,
  GRUB_EDIT: 2,
  BOOTING: 3,
  SHELL_INFO: 3.5,
  REMOUNT: 4,
  CHROOT: 5,
  PASSWD_CMD: 6,
  PASSWD_IN1: 7,
  PASSWD_IN2: 8,
  SELINUX: 9,
  EXIT_CHROOT: 10,
  EXIT_SHELL: 11,
  PRE_REBOOT: 11.5,
  REBOOTING: 12,
  VERIFY_SU: 13,
  VERIFY_PASS: 14,
  SUCCESS: 15,
};

const DEFAULT_GRUB_CONFIG = `setparams 'Red Hat Enterprise Linux (4.18.0-193.el8.x86_64) 8.2 (Ootpa)'
  load_video
  set gfxpayload=keep
  insmod gzio
  linux /vmlinuz-4.18.0-193.el8.x86_64 root=/dev/mapper/rhel-root ro crashkernel=auto resume=/dev/mapper/rhel-swap
  initrd /initramfs-4.18.0-193.el8.x86_64.img`;

const INITIAL_TERMINAL_HISTORY = [
  "Entering emergency mode. Exit the shell to continue.",
  "Type 'journalctl' to view system logs.",
  "You might want to save '/run/initramfs/rdsosreport.txt' to a USB stick or /boot",
  "after mounting them and attach it to a bug report.",
];

export default function App() {
  const [simState, setSimState] = useState(SIM_STATES.PREP);
  const [language, setLanguage] = useState('en');
  const [terminalHistory, setTerminalHistory] = useState(INITIAL_TERMINAL_HISTORY);
  const [errorModal, setErrorModal] = useState({ isOpen: false, typed: "", expected: "", reason: "" });
  const [grubConfig, setGrubConfig] = useState(DEFAULT_GRUB_CONFIG);
  const [tempPassword, setTempPassword] = useState("");
  const [verifyHistory, setVerifyHistory] = useState(["[user@localhost ~]$ "]);

  function getActiveStepNum(state) {
    if (state === SIM_STATES.PREP) return 0;
    if (state === SIM_STATES.GRUB_MENU) return 1;
    if (state === SIM_STATES.GRUB_EDIT) return 2;
    if (state === SIM_STATES.BOOTING || state === SIM_STATES.SHELL_INFO) return 3;
    if (state === SIM_STATES.REMOUNT || state === SIM_STATES.CHROOT) return 4;
    if (state >= SIM_STATES.PASSWD_CMD && state <= SIM_STATES.PASSWD_IN2) return 5;
    if (state === SIM_STATES.SELINUX) return 6;
    if (state === SIM_STATES.EXIT_CHROOT || state === SIM_STATES.EXIT_SHELL || state === SIM_STATES.PRE_REBOOT) return 7;
    if (state >= SIM_STATES.REBOOTING) return 8;
    return 0;
  }

  const showError = (typed, expected, reason) => {
    setErrorModal({ isOpen: true, typed, expected, reason });
  };

  const closeError = () => {
    setErrorModal({ isOpen: false, typed: "", expected: "", reason: "" });
  };

  const resetApp = () => {
    setSimState(SIM_STATES.PREP);
    setTerminalHistory(INITIAL_TERMINAL_HISTORY);
    setVerifyHistory(["[user@localhost ~]$ "]);
    setTempPassword("");
    setGrubConfig(DEFAULT_GRUB_CONFIG);
    closeError();
  };

  const getObjectiveText = (state) => {
    switch (state) {
      case SIM_STATES.PREP: return "Take a snapshot by clicking 'VM' -> 'Snapshot' -> 'Take Snapshot...' in the menu above.";
      case SIM_STATES.GRUB_MENU: return "Press the 'e' key to edit the selected GRUB boot entry.";
      case SIM_STATES.GRUB_EDIT: return "Find the line starting with 'linux'. Go to the VERY END of that line, add a space, type 'rd.break', then press Ctrl+x or F10.";
      case SIM_STATES.BOOTING: return "Wait for the system to boot into emergency mode.";
      case SIM_STATES.SHELL_INFO: return "You are in the emergency shell! Read Step 3 on the left, then press ENTER to proceed.";
      case SIM_STATES.REMOUNT: return "Type: mount -o remount,rw /sysroot";
      case SIM_STATES.CHROOT: return "Type: chroot /sysroot";
      case SIM_STATES.PASSWD_CMD: return "Type: passwd root";
      case SIM_STATES.PASSWD_IN1: return "Type a new password (min 3 chars). Note: Text will be invisible!";
      case SIM_STATES.PASSWD_IN2: return "Retype the new password to confirm.";
      case SIM_STATES.SELINUX: return "Type: touch /.autorelabel";
      case SIM_STATES.EXIT_CHROOT: return "Type: exit";
      case SIM_STATES.EXIT_SHELL: return "Type: exit (or reboot -f if it hangs)";
      case SIM_STATES.PRE_REBOOT: return "Read Step 7 on the left, then press ENTER to actually restart.";
      case SIM_STATES.REBOOTING: return "Wait for system to reboot and apply SELinux labels.";
      case SIM_STATES.VERIFY_SU: return "Type: su -";
      case SIM_STATES.VERIFY_PASS: return "Type your new root password to verify.";
      case SIM_STATES.SUCCESS: return "Demonstration complete!";
      default: return "";
    }
  };

  const handleTerminalCommand = (cmd) => {
    const trimmedCmd = cmd.trim();
    const newHistory = [...terminalHistory];
    
    // Echo the command (except for password inputs)
    if (simState !== SIM_STATES.PASSWD_IN1 && simState !== SIM_STATES.PASSWD_IN2 && simState !== SIM_STATES.PRE_REBOOT) {
      const prompt = simState >= SIM_STATES.PASSWD_CMD && simState <= SIM_STATES.EXIT_CHROOT ? "sh-4.4# " : "switch_root:/# ";
      newHistory.push(prompt + cmd);
    } else {
       // Blind typing for password or just ENTER for pauses
       newHistory.push("");
    }

    setTerminalHistory(newHistory);

    switch (simState) {
      case SIM_STATES.SHELL_INFO:
        if (trimmedCmd === "") {
          setSimState(SIM_STATES.REMOUNT);
        } else if (/^mount\s+-o\s+remount/i.test(trimmedCmd)) {
          // Allow skipping ahead if the user types the step 4 command early
          if (/^mount\s+-o\s+remount,\s*rw\s*\/\s*sysroot$/i.test(trimmedCmd) || /^mount\s+-o\s+remount,rw\s+\/sysroot$/i.test(trimmedCmd)) {
            setSimState(SIM_STATES.CHROOT);
          } else {
            showError(cmd, "mount -o remount,rw /sysroot", "You must remount the real root filesystem (/sysroot) with read-write permissions so you can modify it.");
          }
        } else {
          showError(cmd, "<Press ENTER>", "Take a moment to read the explanation for Step 3 on the left. Then, just press ENTER on an empty line to continue to Step 4.");
        }
        break;

      case SIM_STATES.REMOUNT:
        // More lenient regex to accommodate PDF spacing variants while enforcing correctness
        if (/^mount\s+-o\s+remount,\s*rw\s*\/\s*sysroot$/i.test(trimmedCmd) || /^mount\s+-o\s+remount,rw\s+\/sysroot$/i.test(trimmedCmd)) {
          setSimState(SIM_STATES.CHROOT);
        } else {
          showError(cmd, "mount -o remount,rw /sysroot", "You must remount the real root filesystem (/sysroot) with read-write permissions so you can modify it.");
        }
        break;

      case SIM_STATES.CHROOT:
        if (trimmedCmd === "chroot /sysroot") {
          setSimState(SIM_STATES.PASSWD_CMD);
        } else {
          showError(cmd, "chroot /sysroot", "You must switch (chroot) into the real system environment before changing the password.");
        }
        break;

      case SIM_STATES.PASSWD_CMD:
        if (trimmedCmd === "passwd root" || trimmedCmd === "passwd") {
          setSimState(SIM_STATES.PASSWD_IN1);
        } else {
          showError(cmd, "passwd root", "You need to initiate the password reset for the root user.");
        }
        break;

      case SIM_STATES.PASSWD_IN1:
        if (trimmedCmd.length < 3) {
          showError("******", "A stronger password", "Password is too short for this demonstration. Please use at least 3 characters.");
          newHistory.push("BAD PASSWORD: The password is shorter than 3 characters");
          setSimState(SIM_STATES.PASSWD_CMD);
        } else {
          setTempPassword(trimmedCmd);
          setSimState(SIM_STATES.PASSWD_IN2);
        }
        break;

      case SIM_STATES.PASSWD_IN2:
        if (trimmedCmd === tempPassword) {
          newHistory.push("passwd: all authentication tokens updated successfully.");
          setSimState(SIM_STATES.SELINUX);
        } else {
          showError("******", "Matching password", "The passwords you entered do not match. Try again.");
          newHistory.push("passwd: Authentication token manipulation error");
          newHistory.push("passwd: password unchanged");
          setSimState(SIM_STATES.PASSWD_CMD);
        }
        break;

      case SIM_STATES.SELINUX:
        if (trimmedCmd === "touch /.autorelabel") {
          setSimState(SIM_STATES.EXIT_CHROOT);
        } else {
          showError(cmd, "touch /.autorelabel", "CRUCIAL STEP: RHEL 8 has SELinux enabled. You MUST create the relabel file, otherwise SELinux will block root login even with the right password.");
        }
        break;

      case SIM_STATES.EXIT_CHROOT:
        if (trimmedCmd === "exit") {
          setSimState(SIM_STATES.EXIT_SHELL);
        } else {
          showError(cmd, "exit", "You need to exit the chroot environment to return to the emergency shell.");
        }
        break;

      case SIM_STATES.EXIT_SHELL:
        if (trimmedCmd === "exit" || trimmedCmd === "reboot -f") {
          newHistory.push("logout");
          newHistory.push("");
          newHistory.push("System is ready to reboot.");
          setSimState(SIM_STATES.PRE_REBOOT);
        } else {
          showError(cmd, "exit", "You need to exit the rescue shell so the system can reboot and apply SELinux relabeling.");
        }
        break;

      case SIM_STATES.PRE_REBOOT:
        if (trimmedCmd === "") {
          setSimState(SIM_STATES.REBOOTING);
        } else {
          showError(cmd, "<Press ENTER>", "Take your time to read the explanation for Step 7. When you are ready to restart the server, just press ENTER.");
        }
        break;

      default:
        break;
    }
  };

  const activeStepNum = getActiveStepNum(simState);

  return (
    <div className="flex flex-col xl:flex-row h-screen w-full bg-slate-950 text-slate-200 font-sans">
      
      {/* Left Pane: PDF Guidelines */}
      <div className="w-full xl:w-1/3 bg-slate-900 border-r border-slate-700 flex flex-col p-6 overflow-y-auto shadow-xl z-10">
        <div className="mb-6 pb-4 border-b border-slate-700">
          <h1 className="text-2xl font-bold text-sky-400 mb-1">
            Linux Rescue Mode Simulator
          </h1>
          <div className="flex justify-between items-center mt-3">
            <h2 className="text-[11px] font-mono text-slate-400 truncate mr-2">
              Ref: Complete Demonstration of Linux Single-User Mode.pdf
            </h2>
            
            {/* Language Toggle Buttons */}
            <div className="flex bg-slate-950 rounded-lg p-1 border border-slate-700 shrink-0 shadow-inner">
              <button 
                onClick={() => setLanguage('en')} 
                className={`text-xs px-3 py-1 rounded-md transition-all font-bold ${language === 'en' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
              >English</button>
              <button 
                onClick={() => setLanguage('ms')} 
                className={`text-xs px-3 py-1 rounded-md transition-all font-bold ${language === 'ms' ? 'bg-emerald-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
              >Bahasa Melayu</button>
              <button 
                onClick={() => setLanguage('zh')} 
                className={`text-xs px-3 py-1 rounded-md transition-all font-bold ${language === 'zh' ? 'bg-amber-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
              >Chinese</button>
            </div>
          </div>
        </div>
        
        <div className="space-y-4">
          {GUIDELINE_STEPS.map((step, index) => {
            const isActive = step.stepNum === activeStepNum;
            const isPast = step.stepNum < activeStepNum;
            
            return (
              <div 
                key={index} 
                className={`p-4 rounded-xl transition-all duration-300 relative overflow-hidden ${
                  isActive ? "bg-sky-900/40 border border-sky-500 shadow-[0_0_15px_rgba(14,165,233,0.2)] transform scale-[1.02]" : 
                  isPast ? "bg-slate-800/60 border border-slate-700/50 opacity-60" : "bg-slate-800/30 border border-transparent opacity-40"
                }`}
              >
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-sky-500"></div>
                )}
                <h3 className={`font-semibold mb-2 flex items-center ${isActive ? "text-sky-300" : "text-slate-300"}`}>
                  {isPast && <span className="text-green-500 mr-2 text-lg">✓</span>}
                  {isActive && <span className="animate-pulse w-2 h-2 bg-sky-400 rounded-full mr-2"></span>}
                  {step.title}
                </h3>
                <p className="text-sm whitespace-pre-wrap text-slate-300 font-medium leading-relaxed">
                  {step.content}
                </p>
                
                {/* Dynamic Explanation Box based on selected Language */}
                {isActive && (
                  <div className="mt-4 p-3 bg-slate-950/80 rounded-lg border border-slate-700 shadow-inner animate-in slide-in-from-top-2 duration-300">
                    <h4 className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest border-b border-slate-700 pb-1">
                      {language === 'en' ? 'Explanation' : language === 'ms' ? 'Penerangan' : '解释'}
                    </h4>
                    <div className="text-[13px] leading-snug">
                      {language === 'en' && <p className="text-blue-200">{step.explanation.en}</p>}
                      {language === 'ms' && <p className="text-emerald-200">{step.explanation.ms}</p>}
                      {language === 'zh' && <p className="text-amber-200">{step.explanation.zh}</p>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Pane: VM Simulator Environment */}
      <div className="w-full xl:w-2/3 bg-[#1e1e1e] flex flex-col p-4 sm:p-8 items-center justify-center relative overflow-hidden">
        
        {/* Mock VMware Workstation UI Wrapper */}
        <div className="w-full max-w-5xl bg-[#2d2d2d] rounded-t-lg shadow-2xl border border-gray-700 flex flex-col h-[700px] max-h-[90vh]">
          {/* Menu Bar */}
          <div className="bg-[#3c3c3c] text-gray-300 text-xs flex items-center px-4 py-2 rounded-t-lg border-b border-black">
            <span className="mr-4 hover:bg-gray-600 px-2 py-1 rounded cursor-pointer">File</span>
            <span className="mr-4 hover:bg-gray-600 px-2 py-1 rounded cursor-pointer">Edit</span>
            <span className="mr-4 hover:bg-gray-600 px-2 py-1 rounded cursor-pointer">View</span>
            
            {/* VM Menu Item with Dropdown Simulation */}
            <div className="relative group">
              <span className="mr-4 hover:bg-gray-600 px-2 py-1 rounded cursor-pointer">VM</span>
              {simState === SIM_STATES.PREP && (
                <div className="absolute left-0 top-full mt-1 w-48 bg-[#2d2d2d] border border-gray-600 shadow-xl z-50 rounded">
                  <div className="px-4 py-2 hover:bg-blue-600 cursor-pointer text-gray-200">Power</div>
                  <div className="px-4 py-2 hover:bg-blue-600 cursor-pointer text-gray-200">Removable Devices</div>
                  <div className="border-t border-gray-600 my-1"></div>
                  <div className="px-4 py-2 bg-blue-600 cursor-pointer text-white flex justify-between items-center" 
                       onClick={() => setSimState(SIM_STATES.GRUB_MENU)}>
                    Snapshot
                    <span className="text-[10px]">▶</span>
                  </div>
                  {/* Fake submenu for taking snapshot */}
                  <div className="absolute left-full top-16 ml-0 w-48 bg-[#2d2d2d] border border-gray-600 shadow-xl rounded z-50">
                    <div className="px-4 py-2 hover:bg-blue-600 cursor-pointer text-white font-bold"
                         onClick={() => setSimState(SIM_STATES.GRUB_MENU)}>
                      Take Snapshot...
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <span className="mr-4 hover:bg-gray-600 px-2 py-1 rounded cursor-pointer">Tabs</span>
            <span className="mr-4 hover:bg-gray-600 px-2 py-1 rounded cursor-pointer">Help</span>
          </div>
          
          {}
          {/* Objective Bar */}
          <div className="bg-sky-950 text-sky-100 p-2 sm:p-3 flex items-center border-b border-black text-sm sm:text-base shadow-inner">
            <span className="font-bold mr-3 text-yellow-400 animate-pulse">CURRENT GOAL:</span> 
            <span className="font-mono">{getObjectiveText(simState)}</span>
          </div>

          {/* Tab Bar */}
          <div className="bg-[#2d2d2d] border-b border-black flex px-2 pt-2">
            <div className="bg-[#1e1e1e] text-white text-xs px-4 py-1.5 rounded-t-md border-t border-l border-r border-gray-700 flex items-center">
              <span className="mr-2">📺</span> RHEL 8 - Rescue Demo
              <span className="ml-4 text-gray-500 hover:text-white cursor-pointer">×</span>
            </div>
          </div>

          {/* Actual VM Screen Container */}
          <div className="flex-grow bg-black relative overflow-hidden flex items-center justify-center">
            
            {/* Dynamic Screens based on State */}
            {simState === SIM_STATES.PREP && (
              <PrepScreen />
            )}

            {simState === SIM_STATES.GRUB_MENU && (
              <GrubMenuScreen 
                onEdit={() => setSimState(SIM_STATES.GRUB_EDIT)} 
                showError={showError} 
              />
            )}

            {}
            {simState === SIM_STATES.GRUB_EDIT && (
              <GrubEditScreen 
                config={grubConfig} 
                setConfig={setGrubConfig} 
                onBoot={(config) => {
                  const lines = config.split('\n');
                  const linuxLine = lines.find(l => l.trim().startsWith('linux'));
                  
                  if (linuxLine && (linuxLine.includes(' rd.break') || linuxLine.endsWith('rd.break'))) {
                    setSimState(SIM_STATES.BOOTING);
                  } else if (config.includes('rd.break')) {
                    showError(
                      "Pressed F10/Ctrl+x to boot", 
                      "Append 'rd.break' to the SAME line as 'linux'", 
                      "You typed 'rd.break', but you put it on a new line or the wrong line! Find the line that begins with 'linux', go to the very end of THAT line, add a space, and type 'rd.break'. Do not press Enter to create a new line."
                    );
                  } else {
                    showError(
                      "Pressed F10/Ctrl+x to boot", 
                      "Add 'rd.break' to linux line", 
                      "You did not append 'rd.break' to the line starting with 'linux'. The system cannot boot into the emergency rescue shell without it."
                    );
                  }
                }} 
              />
            )}

            {simState === SIM_STATES.BOOTING && (
              <BootingScreen onComplete={() => setSimState(SIM_STATES.SHELL_INFO)} />
            )}

            {}
            {simState >= SIM_STATES.SHELL_INFO && simState <= SIM_STATES.PRE_REBOOT && (
              <TerminalScreen 
                simState={simState} 
                history={terminalHistory} 
                onCommand={handleTerminalCommand} 
              />
            )}

            {simState === SIM_STATES.REBOOTING && (
              <RebootingScreen onComplete={() => setSimState(SIM_STATES.VERIFY_SU)} />
            )}

            {simState >= SIM_STATES.VERIFY_SU && simState <= SIM_STATES.SUCCESS && (
              <VerificationScreen
                simState={simState}
                setSimState={setSimState}
                history={verifyHistory}
                setHistory={setVerifyHistory}
                tempPassword={tempPassword}
                showError={showError}
                onResetApp={resetApp}
              />
            )}

            {/* Error Modal Overlay (Confined to VM Window) */}
            {errorModal.isOpen && (
              <ErrorDialog modal={errorModal} onClose={closeError} />
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
}

function PrepScreen() {
  return (
    <div className="text-center flex flex-col items-center justify-center p-8 w-full h-full bg-slate-900/50 relative">
      <div className="absolute top-0 left-0 w-full pt-4 flex flex-col items-center pointer-events-none z-20">
        <div className="animate-bounce text-yellow-400 text-5xl">↑</div>
        <div className="text-yellow-400 font-bold text-xl mt-2 bg-black/80 px-6 py-2 rounded-lg border border-yellow-500/50 shadow-[0_0_15px_rgba(250,204,21,0.4)]">CLICK "VM" MENU ABOVE TO BEGIN</div>
      </div>
      <div className="w-24 h-24 mb-6 opacity-70 mt-16 z-10 relative">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-sky-400">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
      </div>
      <h2 className="text-3xl font-bold text-white mb-4">VMware Workstation Simulator</h2>
      <p className="text-lg text-slate-300 max-w-md">
        Follow <strong>Step 0</strong> in the guideline. <br/><br/>
        Use the mock <strong>"VM"</strong> menu at the top of this window to take a snapshot before we begin the rescue operation.
      </p>
      <div className="mt-8 animate-bounce text-sky-400">
        ↑ Look up at the menu bar ↑
      </div>
    </div>
  );
}

function GrubMenuScreen({ onEdit, showError }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key.toLowerCase() === 'e') {
        onEdit();
      } else if (e.key === 'Enter') {
        showError("Pressed Enter (Boot)", "Press 'e' to edit", "Pressing Enter boots the system normally. You need to edit the kernel parameters to enter Single-User Mode.");
      } else if (['ArrowUp', 'ArrowDown', 'Escape'].includes(e.key)) {
        // Just simulate the interaction, no error
      } else {
        // Any other key
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onEdit, showError]);

  return (
    <div className="w-full h-full bg-black text-gray-300 font-mono text-base p-2 flex flex-col">
      <div className="border-4 border-gray-300 h-full p-4 flex flex-col">
        <div className="text-center mb-6">
          <div className="bg-gray-300 text-black px-4 inline-block font-bold">GNU GRUB version 2.02</div>
        </div>
        
        <div className="flex-grow border-[3px] border-gray-300 p-1 mb-8">
          <div className="bg-gray-300 text-black px-2 py-1 flex items-center">
            <span>*Red Hat Enterprise Linux (4.18.0-193.el8.x86_64) 8.2 (Ootpa)</span>
          </div>
          <div className="px-2 py-1">
            System setup
          </div>
        </div>

        <div className="text-sm space-y-2 mt-auto">
          <p>Use the <span className="text-white">↑</span> and <span className="text-white">↓</span> keys to change the selection.</p>
          <p>Press <span className="text-white font-bold">'e'</span> to edit the selected commands before booting or 'c' for a command-line.</p>
        </div>
      </div>
    </div>
  );
}

function GrubEditScreen({ config, setConfig, onBoot }) {
  const textareaRef = useRef(null);

  // Only set cursor to the end ONCE when the screen first appears
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, []); // Empty dependency array means it only runs on mount

  // Handle the F10 / Ctrl+x boot commands
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F10' || (e.ctrlKey && e.key === 'x')) {
        e.preventDefault();
        onBoot(config);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [config, onBoot]);

  return (
    <div className="w-full h-full bg-black text-gray-300 font-mono text-base p-2 flex flex-col">
      <div className="border-4 border-gray-300 h-full p-4 flex flex-col">
        <div className="text-center mb-4">
          <div className="bg-gray-300 text-black px-4 inline-block font-bold">GNU GRUB version 2.02</div>
        </div>
        
        <div className="flex-grow border-[3px] border-gray-300 p-2 mb-4 relative overflow-hidden">
          <textarea 
            ref={textareaRef}
            value={config}
            onChange={(e) => setConfig(e.target.value)}
            className="w-full h-full bg-transparent text-gray-300 outline-none resize-none font-mono leading-relaxed"
            spellCheck="false"
          />
        </div>

        <div className="text-sm space-y-2">
          <p>Minimum Emacs-like screen editing is supported. TAB lists completions. Press <span className="text-white font-bold">Ctrl-x</span> or <span className="text-white font-bold">F10</span> to boot, Ctrl-c or F2 for a command-line.</p>
        </div>
      </div>
    </div>
  );
}

function BootingScreen({ onComplete }) {
  const [logs, setLogs] = useState([]);
  
  useEffect(() => {
    const bootSequence = [
      "Loading Linux 4.18.0-193.el8.x86_64 ...",
      "Loading initial ramdisk ...",
      "Probing EDD (edd=off to disable)... ok",
      "[    0.000000] Linux version 4.18.0-193.el8.x86_64 (mock@redhat.com)",
      "[    0.000000] Command line: BOOT_IMAGE=/vmlinuz-4.18.0 root=/dev/mapper/rhel-root ro rd.break",
      "[    0.234123] smpboot: CPU0: Intel(R) Core(TM) i7 CPU @ 2.60GHz (family: 0x6, model: 0x9e)",
      "[    1.452312] systemd[1]: Reached target Basic System.",
      "[    1.503423] systemd[1]: Starting Dracut Emergency Shell...",
      "Generating \"/run/initramfs/rdsosreport.txt\"",
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < bootSequence.length) {
        const nextLog = bootSequence[i];
        setLogs(prev => [...prev, nextLog || ""]);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(onComplete, 800);
      }
    }, 150);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="w-full h-full bg-black text-gray-300 font-mono text-sm p-4 overflow-hidden">
      {logs.map((log, index) => {
        // Defensive cast to prevent React child errors
        const text = typeof log === 'string' ? log : String(log || "");
        return <div key={index}>{text}</div>;
      })}
    </div>
  );
}

function RebootingScreen({ onComplete }) {
  const [logs, setLogs] = useState(["[  OK  ] Reached target Reboot."]);
  
  useEffect(() => {
    const sequence = [
      "Restarting system.",
      "",
      "Loading Linux ...",
      "Loading initial ramdisk ...",
      "*** SELinux relabeling in progress ***",
      "*** This may take a while depending on file size ***",
      "[  OK  ] Relabeling complete.",
      "[  OK  ] Started GNOME Display Manager.",
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < sequence.length) {
        const nextLog = sequence[i];
        setLogs(prev => [...prev, nextLog || ""]);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(onComplete, 1000);
      }
    }, 300);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="w-full h-full bg-black text-gray-300 font-mono text-sm p-4 overflow-hidden">
      {logs.map((log, index) => {
        // Defensive check to prevent .includes crash on undefined/objects
        const text = typeof log === 'string' ? log : String(log || "");
        const isSELinux = text.includes("SELinux");
        return (
          <div key={index} className={isSELinux ? "text-yellow-400 font-bold" : ""}>
            {text}
          </div>
        );
      })}
    </div>
  );
}

function TerminalScreen({ simState, history, onCommand }) {
  const [inputValue, setInputValue] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "auto" });
  }, [history, inputValue]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      onCommand(inputValue);
      setInputValue("");
    }
  };

  let prompt = "switch_root:/# ";
  if (simState >= 6 && simState <= 10) { // SIM_STATES ranges for chroot
    prompt = "sh-4.4# ";
  }

  let displayPrompt = prompt;
  let isPasswordInput = false;
  if (simState === 7) { // PASSWD_IN1
    displayPrompt = "Changing password for user root.\nNew password: ";
    isPasswordInput = true;
  } else if (simState === 8) { // PASSWD_IN2
    displayPrompt = "Retype new password: ";
    isPasswordInput = true;
  } else if (simState === 11.5) { // PRE_REBOOT
    displayPrompt = "Press ENTER to reboot... ";
  }

  return (
    <div className="w-full h-full bg-black text-green-400 font-mono text-base p-4 overflow-y-auto flex flex-col">
      <div className="flex-grow">
        {history.map((line, i) => {
          const text = typeof line === 'string' ? line : String(line || "");
          return <div key={i} className="whitespace-pre-wrap">{text}</div>;
        })}
        
        <div className="flex mt-1">
          <span className="whitespace-pre-wrap mr-2">{displayPrompt}</span>
          <input 
            type={isPasswordInput ? "password" : "text"}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="flex-grow bg-transparent text-green-400 outline-none border-none focus:ring-0 p-0 font-mono"
            autoComplete="off"
            spellCheck="false"
          />
        </div>
        <div ref={endRef} />
      </div>
    </div>
  );
}

function VerificationScreen({ simState, setSimState, history, setHistory, tempPassword, showError, onResetApp }) {
  const [inputValue, setInputValue] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "auto" });
  }, [history]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const cmd = inputValue.trim();
      setInputValue("");
      
      const newHistory = [...history];
      
      if (simState === 13) { // VERIFY_SU
        newHistory.push("[user@localhost ~]$ " + cmd);
        if (cmd === "su -") {
          newHistory.push("Password: ");
          setHistory(newHistory);
          setSimState(14); // VERIFY_PASS
        } else if (cmd === "su") {
          setHistory(newHistory);
          showError(cmd, "su -", "Almost there! But according to the guideline, you should use 'su -' (with a dash) to fully load the root environment variables.");
        } else {
          setHistory(newHistory);
          showError(cmd, "su -", "You must type 'su -' to switch user to root and verify your new password.");
        }
      } else if (simState === 14) { // VERIFY_PASS
        newHistory.push(""); // blind typing
        if (cmd === tempPassword) {
          newHistory.push("[root@localhost user]# ");
          setHistory(newHistory);
          setSimState(15); // SUCCESS
        } else {
          newHistory.push("su: Authentication failure");
          newHistory.push("[user@localhost ~]$ ");
          setHistory(newHistory);
          setSimState(13); // VERIFY_SU
          showError("******", tempPassword, "Incorrect password. You must enter the NEW password you created in Step 5.");
        }
      }
    }
  };

  const isPassword = simState === 14; // VERIFY_PASS
  
  if (simState === 15) { // SUCCESS
    return (
      <div className="w-full h-full bg-black flex items-center justify-center p-8">
        <div className="bg-slate-800 border border-green-500 rounded-xl p-8 max-w-md text-center shadow-[0_0_30px_rgba(34,197,94,0.3)]">
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Success!</h2>
          <p className="text-slate-300 mb-6">
            You successfully switched to root using your new password. The Single-User Mode demonstration is fully complete.
          </p>
          <button 
            onClick={onResetApp}
            className="px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-lg transition-colors"
          >
            Restart Demonstration
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-black text-gray-300 font-mono text-base p-4 overflow-y-auto flex flex-col">
      <div className="text-yellow-400 mb-4 font-bold border-b border-gray-700 pb-2">
        # System booted successfully. Open Terminal to test root login.
      </div>
      <div className="flex-grow">
        {history.map((line, i) => {
          const text = typeof line === 'string' ? line : String(line || "");
          return <div key={i} className="whitespace-pre-wrap">{text}</div>;
        })}
        
        {simState !== 15 && (
          <div className="flex mt-1">
            <span className="whitespace-pre-wrap mr-2">
              {simState === 13 ? "[user@localhost ~]$ " : ""}
            </span>
            <input 
              type={isPassword ? "password" : "text"}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              className="flex-grow bg-transparent text-gray-300 outline-none border-none focus:ring-0 p-0 font-mono"
              autoComplete="off"
              spellCheck="false"
            />
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

function ErrorDialog({ modal, onClose }) {
  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 p-6 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1e1e1e] border-2 border-red-500 rounded-xl max-w-lg w-full shadow-2xl shadow-red-900/40 flex flex-col overflow-hidden">
        <div className="bg-red-950/50 px-6 py-4 border-b border-red-900 flex items-center">
          <div className="bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center mr-3 font-bold text-xl shadow-lg">
            !
          </div>
          <h3 className="text-xl font-bold text-red-400">Action Incorrect</h3>
        </div>
        
        <div className="p-6 space-y-5">
          <div className="space-y-1">
            <span className="text-red-400 text-xs uppercase font-bold tracking-wider ml-1">You Typed / Did:</span>
            <div className="bg-black/60 p-3 rounded-lg border border-red-900/50 font-mono text-gray-300 break-all">
              {modal.typed || "<Empty / Invalid Key>"}
            </div>
          </div>
          
          <div className="space-y-1">
            <span className="text-green-400 text-xs uppercase font-bold tracking-wider ml-1">You Should Type / Do:</span>
            <div className="bg-black/60 p-3 rounded-lg border border-green-900/50 font-mono text-green-400 font-bold break-all">
              {modal.expected}
            </div>
          </div>

          <div className="bg-blue-950/30 p-4 rounded-lg border border-blue-900/30">
            <span className="text-blue-400 text-xs uppercase font-bold tracking-wider mb-1 block">Explanation:</span>
            <p className="text-slate-300 text-sm leading-relaxed">{modal.reason}</p>
          </div>
        </div>

        <div className="px-6 py-4 bg-black/40 border-t border-gray-800">
          <button 
            onClick={onClose}
            className="w-full py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold rounded-lg transition-colors shadow-lg"
          >
            I understand, let me try again
          </button>
        </div>
      </div>
    </div>
  );
}