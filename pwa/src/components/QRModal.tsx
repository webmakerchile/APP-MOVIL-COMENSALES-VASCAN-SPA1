import React from "react";
import { X, CheckCircle } from "lucide-react";

interface QRModalProps {
  qrCode: string;
  opcionNum: number;
  opcionText: string;
  fecha: string;
  onClose: () => void;
}

const DAYS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MONTHS_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return `${DAYS_ES[d.getDay()]} ${d.getDate()} de ${MONTHS_FULL[d.getMonth()]}`;
}

export default function QRModal({ opcionNum, opcionText, fecha, onClose }: QRModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm bg-[#16213E] border border-white/10 rounded-2xl overflow-hidden slide-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <h3 className="text-white font-semibold text-base">Inscripción Confirmada</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/6 flex items-center justify-center text-white/50 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 flex flex-col items-center gap-4">
          <p className="text-white/50 text-sm">{formatDate(fecha)}</p>

          <div className="text-center">
            <p className="text-vascan-gold font-semibold text-lg">Opción {opcionNum}</p>
            <p className="text-white/70 text-sm mt-1 leading-relaxed">{opcionText}</p>
          </div>

          <p className="text-white/40 text-xs text-center">
            Retira tu vale impreso en el tótem del casino el día del servicio.
          </p>

          <button
            onClick={onClose}
            className="w-full bg-white/6 hover:bg-white/10 border border-white/10 text-white/80 font-medium py-3 rounded-xl transition-colors text-sm"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
