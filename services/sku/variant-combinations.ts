export interface VariantOptionInput {
  name: string;
  values: string[];
}

export interface GeneratedCombination {
  options: Record<string, string>;
  title: string;
  combinationKey: string;
  isGlobalFallback?: boolean;
}

/**
 * Calculates the Cartesian product of N dynamic variant options.
 * If no options are provided or option values are empty, returns 1 fallback entry for Global SKU generation.
 */
export function generateCartesianCombinations(
  options: VariantOptionInput[]
): GeneratedCombination[] {
  // Filter out options with no name or no values
  const validOptions = (options || []).filter(
    (opt) => opt.name && opt.name.trim().length > 0 && opt.values && opt.values.length > 0
  );

  // If no variant options are configured, return 1 default combination for Global SKU generation
  if (validOptions.length === 0) {
    return [
      {
        options: {},
        title: "Default Title (Global SKU)",
        combinationKey: "default",
        isGlobalFallback: true,
      },
    ];
  }

  // Recursive Cartesian product calculation
  function cartesian(index: number): Record<string, string>[] {
    if (index === validOptions.length) {
      return [{}];
    }

    const currentOption = validOptions[index];
    const subCombinations = cartesian(index + 1);
    const result: Record<string, string>[] = [];

    for (const value of currentOption.values) {
      const cleanVal = value.trim();
      if (!cleanVal) continue;

      for (const sub of subCombinations) {
        result.push({
          [currentOption.name.trim()]: cleanVal,
          ...sub,
        });
      }
    }

    return result;
  }

  const rawCombinations = cartesian(0);

  return rawCombinations.map((combo) => {
    const titleParts = validOptions.map((opt) => combo[opt.name.trim()] || "");
    const title = titleParts.filter(Boolean).join(" / ");

    const combinationKey = validOptions
      .map((opt) => {
        const optName = opt.name.trim().toLowerCase();
        const optVal = (combo[opt.name.trim()] || "").trim().toLowerCase();
        return `${optName}:${optVal}`;
      })
      .sort()
      .join("|");

    return {
      options: combo,
      title: title || "Default Title",
      combinationKey,
      isGlobalFallback: false,
    };
  });
}
