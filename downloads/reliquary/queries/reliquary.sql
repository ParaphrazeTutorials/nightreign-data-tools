WITH RelicEffectCTE
AS 
(

SELECT 

   aep.ID AS `EffectID` -- RelicID
  ,aep.overrideBaseEffectId AS `OverrideBaseEffectID`
  ,CONCAT(LPAD(CAST(aep.overrideBaseEffectID AS STRING), 4, '0'), CAST(aep.id AS string)) AS `RawRollOrder` -- The Roll Order is determined by a string concat of the OverrideBaseEffectID and the EffectID. You must convert the OverrideBaseEffectID to be 4 characters first, thus the LPAD. (0001 is very different than 1 for our purposes)
  ,aep.compatibilityId AS `CompatibilityID`
  ,c.CompatibilityDescription AS `EffectCategory`
  ,aen.Text AS `EffectDescription`
  -- ChanceWeight determines legality of a roll and which set of relics it can be on. 0 or null can not be rolled, any value above this is possible. 
  -- ChanceWeight_DLC modifies the above if DLC is installed. It is an override. In Smithbox it reads as -1(255) but I have translated them in the table with =sum(chanceWeight) for human readability. (Notes from Acarii)
  -- Based on this, we conclude that if ChanceWeightDLC is 255, we should take the normal value. Otherwise, it overrides.
  ,CASE
    WHEN p110.attachEffectId IS NULL
      THEN 0
    WHEN p110.chanceWeight_dlc = 255
      THEN p110.chanceWeight
    ELSE p110.chanceWeight_dlc
    END AS `ChanceWeight_110`
  ,CASE
    WHEN p210.attachEffectId IS NULL
      THEN 0
    WHEN p210.chanceWeight_dlc = 255
      THEN p210.chanceWeight
    ELSE p210.chanceWeight_dlc
    END AS `ChanceWeight_210`
  ,CASE
    WHEN p310.attachEffectId IS NULL
      THEN 0
    WHEN p310.chanceWeight_dlc = 255
      THEN p310.chanceWeight
    ELSE p310.chanceWeight_dlc
    END AS `ChanceWeight_310`
  ,CASE
    WHEN p2000000.attachEffectId IS NULL
      THEN 0
    WHEN p2000000.chanceWeight_dlc = 255
      THEN p2000000.chanceWeight
    ELSE p2000000.chanceWeight_dlc
    END AS `ChanceWeight_2000000`
  ,CASE
    WHEN p2200000.attachEffectId IS NULL
      THEN 0
    WHEN p2200000.chanceWeight_dlc = 255
      THEN p2200000.chanceWeight
    ELSE p2200000.chanceWeight_dlc
    END AS `ChanceWeight_2200000`
  ,CASE
    WHEN p3000000.attachEffectId IS NULL
      THEN 0
    WHEN p3000000.chanceWeight_dlc = 255
      THEN p3000000.chanceWeight
    ELSE p3000000.chanceWeight_dlc
    END AS `ChanceWeight_3000000`
  ,aep.StatusIconID AS `StatusIconID`
  ,CASE
    WHEN p2000000.chanceWeight > 0
      THEN 1
    ELSE 0
    END AS `CurseRequired`
  ,CASE
    WHEN P3000000.chanceWeight > 0
      THEN 1
    ELSE 0
    END AS `Curse`

FROM `AttachEffectParam` aep
LEFT JOIN `AttachEffectName` aen
  ON aen.ID = aep.attachTextId 
LEFT JOIN `AttachEffectTableParam` p110
  ON p110.attachEffectId = aep.ID
  AND p110.ID = 110 -- This represents a small relic roll on the DLC.
LEFT JOIN `AttachEffectTableParam` p210
  ON p210.attachEffectId = aep.ID
  AND p210.ID = 210 -- This represents a medium relic roll on the DLC.
LEFT JOIN `AttachEffectTableParam` p310
  ON p310.attachEffectId = aep.ID
  AND p310.ID = 310 -- This represents a medium relic roll on the DLC.
LEFT JOIN `AttachEffectTableParam` p2000000
  ON p2000000.attachEffectId = aep.ID
  AND p2000000.ID = 2000000 -- This represents a Depth of Night roll, and will ALWAYS have a curse.
LEFT JOIN `AttachEffectTableParam` p2200000
  ON p2200000.attachEffectId = aep.ID
  AND p2200000.ID = 2200000 -- This represents a Depth of Night roll that does not have any curses. 2200000 is for 1.03, previously this was 2100000.
LEFT JOIN `AttachEffectTableParam` p3000000
  ON p3000000.attachEffectId = aep.ID
  AND p3000000.ID = 3000000 -- This represents a Depth of Night curse roll only. Right now, these only prevent duplicates.
LEFT JOIN `Compatibility` c
  ON c.CompatibilityID = aep.compatibilityId

)

SELECT 
   r.*
  ,CASE
    WHEN (r.ChanceWeight_110 + r.ChanceWeight_210 + r.ChanceWeight_310) > 0 AND (r.ChanceWeight_2000000 + r.ChanceWeight_2200000 + r.ChanceWeight_3000000) > 0
      THEN 'Both'
    WHEN (r.ChanceWeight_110 + r.ChanceWeight_210 + r.ChanceWeight_310) > 0 AND (r.ChanceWeight_2000000 + r.ChanceWeight_2200000 + r.ChanceWeight_3000000) <= 0
      THEN 'Standard'
    WHEN (r.ChanceWeight_110 + r.ChanceWeight_210 + r.ChanceWeight_310) <= 0 AND (r.ChanceWeight_2000000 + r.ChanceWeight_2200000 + r.ChanceWeight_3000000) > 0
      THEN 'Depth Of Night'
    ELSE 'Unknown'
    END AS `RelicType`
  ,ROW_NUMBER() OVER(ORDER BY r.RawRollOrder ASC) AS `RollOrder` -- Roll order determines which effects can roll after the current effect. For example, if the first EffectID is 5, you may not roll EffectID 1-4, regardless of their CompatibilityID.

FROM RelicEffectCTE r

WHERE 
  r.ChanceWeight_110 + r.ChanceWeight_210 + r.ChanceWeight_310 + r.ChanceWeight_2000000 + r.ChanceWeight_2200000 + r.ChanceWeight_3000000 > 0 -- We don't want anything that cannot actually roll.
    AND
  r.`Curse` = 0

UNION ALL

SELECT 
   r.*
  ,CASE
    WHEN (r.ChanceWeight_110 + r.ChanceWeight_210 + r.ChanceWeight_310) > 0 AND (r.ChanceWeight_2000000 + r.ChanceWeight_2200000 + r.ChanceWeight_3000000) > 0
      THEN 'Both'
    WHEN (r.ChanceWeight_110 + r.ChanceWeight_210 + r.ChanceWeight_310) > 0 AND (r.ChanceWeight_2000000 + r.ChanceWeight_2200000 + r.ChanceWeight_3000000) <= 0
      THEN 'Standard'
    WHEN (r.ChanceWeight_110 + r.ChanceWeight_210 + r.ChanceWeight_310) <= 0 AND (r.ChanceWeight_2000000 + r.ChanceWeight_2200000 + r.ChanceWeight_3000000) > 0
      THEN 'Depth Of Night'
    ELSE 'Unknown'
    END AS `RelicType`
  ,NULL AS `RollOrder`

FROM RelicEffectCTE r
WHERE 
  r.ChanceWeight_110 + r.ChanceWeight_210 + r.ChanceWeight_310 + r.ChanceWeight_2000000 + r.ChanceWeight_2200000 + r.ChanceWeight_3000000 > 0 -- We don't want anything that cannot actually roll.
    AND
  r.`Curse` = 1









