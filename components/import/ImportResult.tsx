import React from 'react';

interface ImportResultProps {
  result: {
    totalProducts: number;
    successCount: number;
    failedCount: number;
    failedDetails?: { handle: string; errors: string[] }[];
    error?: string;
  };
  onReset: () => void;
}

export function ImportResult({ result, onReset }: ImportResultProps) {
  if (result.error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
          <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-red-900 mb-2">Import Failed</h3>
        <p className="text-red-700 mb-6">{result.error}</p>
        <button 
          onClick={onReset}
          className="px-6 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
        >
          Try Again
        </button>
      </div>
    );
  }

  const isSuccess = result.failedCount === 0;

  return (
    <div>
      <div className={`border rounded-lg p-8 text-center mb-6 ${isSuccess ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
        <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${isSuccess ? 'bg-green-100' : 'bg-yellow-100'}`}>
          {isSuccess ? (
            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
        </div>
        <h3 className={`text-lg font-bold mb-2 ${isSuccess ? 'text-green-900' : 'text-yellow-900'}`}>
          {isSuccess ? 'Import Completed Successfully' : 'Import Completed with Errors'}
        </h3>
        <div className="flex justify-center gap-8 mt-6">
          <div className="text-center">
            <p className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Total</p>
            <p className="text-2xl font-bold text-gray-900">{result.totalProducts}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Success</p>
            <p className="text-2xl font-bold text-green-600">{result.successCount}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500 uppercase tracking-wider font-semibold">Failed</p>
            <p className="text-2xl font-bold text-red-600">{result.failedCount}</p>
          </div>
        </div>
      </div>
      
      {result.failedDetails && result.failedDetails.length > 0 && (
        <div className="bg-white border border-red-200 rounded-lg p-6 mb-6">
          <h4 className="text-sm font-bold text-red-900 mb-4">Failed Items Details</h4>
          <div className="max-h-60 overflow-y-auto">
            <ul className="space-y-3">
              {result.failedDetails.map((detail, idx) => (
                <li key={idx} className="bg-red-50 p-3 rounded text-sm text-red-800">
                  <p className="font-semibold mb-1">Handle: {detail.handle}</p>
                  <ul className="list-disc pl-5 opacity-90">
                    {detail.errors.map((err, i) => (
                      <li key={i}>{typeof err === 'object' ? JSON.stringify(err) : err}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="flex justify-center">
        <button 
          onClick={onReset}
          className="px-6 py-2.5 bg-[var(--color-primary,#a7cd18)] hover:bg-[var(--color-primary-hover,#96bb13)] text-black text-sm font-black rounded-xl border border-[#91b212] transition-all shadow-xs cursor-pointer"
        >
          Import Another File
        </button>
      </div>
    </div>
  );
}
