tag @s add zhongli
execute at @s run summon zhongli:pillar ~1 ~1 ~1 
execute at @s run effect @s resistance 999 4 true
tag @a[rm=2] remove zhongli
execute at @s run kill @e[type=zhongli:pillar, rm=3]